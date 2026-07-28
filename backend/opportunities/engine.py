from datetime import timedelta
from decimal import Decimal
import time

from django.db import OperationalError, transaction
from django.db.models import Count, F, Max, Sum
from django.db.models.functions import Coalesce
from django.utils import timezone

from inventory.models import Ingredient, InventoryMovement
from negocios.operations import ensure_business_settings, get_business_open_status
from pedidos.customers import get_customers_for_business
from pedidos.metrics import ACTIVE_ORDER_STATUSES, get_day_bounds
from pedidos.models import DetallePedido, Pedido
from productos.models import Producto
from promociones.models import Promocion
from purchases.models import PurchaseItem
from recetas.costing import calculate_product_cost
from recetas.models import RecipeIngredient
from .models import BusinessOpportunity


SEVERITY_PRIORITY = {'critical': 4, 'warning': 3, 'info': 2, 'success': 1}
OPPORTUNITY_UPDATE_FIELDS = [
    'opportunity_type', 'category', 'title', 'message', 'severity', 'priority',
    'score_impact', 'action_label', 'action_url', 'metadata', 'active',
    'dismissed', 'resolved_at', 'updated_at',
]


class OpportunityGenerationBusy(Exception):
    pass


def _spec(opportunity_type, category, title, message, severity, priority, score_impact=0, action_label='', action_url='', metadata=None, key=''):
    return {
        'opportunity_type': opportunity_type,
        'category': category,
        'title': title,
        'message': message,
        'severity': severity,
        'priority': priority,
        'score_impact': score_impact,
        'action_label': action_label,
        'action_url': action_url,
        'metadata': metadata or {},
        'fingerprint': key,
    }


def evaluate_stock_rules(business, at_datetime):
    specs = []
    ingredients = list(Ingredient.objects.filter(negocio=business, active=True))
    recent_cutoff = at_datetime - timedelta(days=7)
    recently_purchased_ids = set(
        PurchaseItem.objects
        .filter(purchase__negocio=business, purchase__status='confirmed', purchase__confirmed_at__gte=recent_cutoff)
        .values_list('ingredient_id', flat=True)
    )
    for ingredient in ingredients:
        if ingredient.current_stock <= ingredient.minimum_stock:
            has_recent_purchase = ingredient.id in recently_purchased_ids
            specs.append(_spec(
                'low_stock', 'stock',
                f'Queda poco stock de {ingredient.name}',
                f'Tenes {ingredient.current_stock} {ingredient.unit} y el minimo configurado es {ingredient.minimum_stock} {ingredient.unit}.' + ('' if has_recent_purchase else ' No registra compras recientes.'),
                'critical' if ingredient.current_stock <= 0 else 'warning',
                90 if ingredient.current_stock <= 0 else 72,
                5,
                'Ver inventario' if has_recent_purchase else 'Registrar compra',
                f'/inventario?highlight={ingredient.id}' if has_recent_purchase else '/compras',
                {'ingredient_id': ingredient.id, 'stock': str(ingredient.current_stock), 'minimum_stock': str(ingredient.minimum_stock), 'has_recent_purchase': has_recent_purchase},
                f'low_stock:business_{business.id}:ingredient_{ingredient.id}',
            ))

    since = at_datetime - timedelta(days=14)
    consumptions = (
        InventoryMovement.objects
        .filter(ingredient__negocio=business, movement_type=InventoryMovement.TYPE_SALE_CONSUMPTION, created_at__gte=since)
        .values('ingredient_id')
        .annotate(total=Coalesce(Sum('quantity'), Decimal('0.000')))
    )
    by_ingredient = {row['ingredient_id']: row['total'] / Decimal('14') for row in consumptions if row['total'] > 0}
    for ingredient in ingredients:
        average = by_ingredient.get(ingredient.id)
        if not average:
            continue
        days_remaining = ingredient.current_stock / average if average > 0 else None
        if days_remaining is not None and days_remaining <= 3:
            specs.append(_spec(
                'stockout_risk', 'stock',
                f'{ingredient.name} podria agotarse pronto',
                f'Al ritmo actual, podria agotarse en {days_remaining.quantize(Decimal("0.1"))} dias.',
                'warning',
                70,
                4,
                'Ver inventario',
                f'/inventario?highlight={ingredient.id}',
                {'ingredient_id': ingredient.id, 'days_remaining': str(days_remaining), 'average_daily_consumption': str(average), 'data_period_days': 14},
                f'stockout_risk:business_{business.id}:ingredient_{ingredient.id}',
            ))
    return specs


def evaluate_profitability_rules(business, at_datetime):
    specs = []
    settings = ensure_business_settings(business)
    products = Producto.objects.filter(negocio=business, available=True).prefetch_related('recipe_items__ingredient', 'cost_snapshots')
    for product in products:
        data = calculate_product_cost(product)
        if data['ingredients_count'] == 0 or data['missing_costs']:
            specs.append(_spec(
                'incomplete_recipe' if data['ingredients_count'] == 0 else 'missing_cost',
                'profitability',
                f'Completa el costeo de {product.name}',
                'Falta cargar la receta.' if data['ingredients_count'] == 0 else f'Falta cargar costo de: {", ".join(data["missing_costs"])}.',
                'warning',
                62,
                3,
                'Ver receta',
                f'/productos?highlight={product.id}',
                {'product_id': product.id, 'missing_costs': data['missing_costs']},
                f'profitability_incomplete:business_{business.id}:product_{product.id}',
            ))
        if data['recipe_cost'] > data['sale_price'] and data['recipe_cost'] > 0:
            specs.append(_spec(
                'negative_profit', 'profitability',
                f'{product.name} tiene ganancia negativa',
                f'Cuesta ${data["recipe_cost"]} y se vende a ${data["sale_price"]}.',
                'critical',
                92,
                8,
                'Analizar margen',
                f'/costos?product={product.id}',
                {'product_id': product.id, 'recipe_cost': str(data['recipe_cost']), 'sale_price': str(data['sale_price'])},
                f'negative_profit:business_{business.id}:product_{product.id}',
            ))
        elif data['margin_percentage'] is not None and data['margin_percentage'] < settings.low_margin_threshold:
            specs.append(_spec(
                'low_margin', 'profitability',
                f'Revisa el margen de {product.name}',
                f'Margen actual {data["margin_percentage"]}% por debajo del limite {settings.low_margin_threshold}%.',
                'warning',
                76,
                3,
                'Ver analisis',
                f'/costos?product={product.id}',
                {'product_id': product.id, 'margin_percentage': str(data['margin_percentage'])},
                f'low_margin:business_{business.id}:product_{product.id}',
            ))
    top = (
        DetallePedido.objects
        .filter(pedido__negocio=business, pedido__status__in=ACTIVE_ORDER_STATUSES, pedido__created_at__gte=at_datetime - timedelta(days=14))
        .values(product_id=F('producto_id'), name=F('product_name'))
        .annotate(profit=Coalesce(Sum('profit'), Decimal('0.00')))
        .order_by('-profit')
        .first()
    )
    if top and top['profit'] > 0:
        specs.append(_spec(
            'top_product', 'achievement',
            f'{top["name"]} es tu producto mas rentable reciente',
            f'Genero ${top["profit"]} de ganancia historica en los ultimos 14 dias.',
            'success',
            38,
            0,
            'Ver costos',
            f'/costos?product={top["product_id"]}',
            {'product_id': top['product_id'], 'profit': str(top['profit'])},
            f'top_profit_product:business_{business.id}:product_{top["product_id"]}',
        ))
    return specs


def evaluate_sales_rules(business, at_datetime):
    specs = []
    today = timezone.localdate()
    start, end = get_day_bounds(today)
    yesterday_start, yesterday_end = get_day_bounds(today - timedelta(days=1))
    today_sales = Pedido.objects.filter(negocio=business, status__in=ACTIVE_ORDER_STATUSES, created_at__gte=start, created_at__lt=end).aggregate(total=Coalesce(Sum('total'), Decimal('0.00')))['total']
    yesterday_sales = Pedido.objects.filter(negocio=business, status__in=ACTIVE_ORDER_STATUSES, created_at__gte=yesterday_start, created_at__lt=yesterday_end).aggregate(total=Coalesce(Sum('total'), Decimal('0.00')))['total']
    if yesterday_sales > 0:
        change = ((today_sales - yesterday_sales) / yesterday_sales) * Decimal('100')
        if change >= 15:
            specs.append(_spec('sales_growth', 'achievement', 'Hoy estas vendiendo mas que ayer', f'Las ventas subieron {change.quantize(Decimal("0.1"))}% contra ayer.', 'success', 42, 0, 'Ver dashboard', '/dashboard', {'change': str(change)}, f'sales_growth:business_{business.id}:{today}'))
        elif change <= -25:
            specs.append(_spec('sales_drop', 'sales', 'Las ventas de hoy vienen por debajo de ayer', f'La caida actual es de {abs(change).quantize(Decimal("0.1"))}%.', 'warning', 58, 3, 'Ver dashboard', '/dashboard', {'change': str(change)}, f'sales_drop:business_{business.id}:{today}'))

    top = (
        DetallePedido.objects
        .filter(pedido__negocio=business, pedido__status__in=ACTIVE_ORDER_STATUSES, pedido__created_at__gte=start, pedido__created_at__lt=end)
        .values(product_id=F('producto_id'), name=F('product_name'))
        .annotate(quantity=Coalesce(Sum('quantity'), 0), revenue=Coalesce(Sum('subtotal'), Decimal('0.00')))
        .order_by('-quantity', '-revenue')
        .first()
    )
    if top:
        specs.append(_spec('top_product', 'sales', f'{top["name"]} es el producto estrella del dia', f'Lidera por cantidad vendida: {top["quantity"]} unidades.', 'info', 36, 0, 'Ver productos', f'/productos?highlight={top["product_id"]}', {'metric': 'quantity', 'quantity': top['quantity']}, f'top_product_today:business_{business.id}:{today}:product_{top["product_id"]}'))

    settings = ensure_business_settings(business)
    cutoff = at_datetime - timedelta(days=settings.dead_product_days)
    sold_product_ids = DetallePedido.objects.filter(pedido__negocio=business, pedido__status__in=ACTIVE_ORDER_STATUSES, pedido__created_at__gte=cutoff).values_list('producto_id', flat=True)
    for product in Producto.objects.filter(negocio=business, available=True).exclude(id__in=sold_product_ids)[:10]:
        specs.append(_spec('dead_product', 'sales', f'{product.name} no se vende hace {settings.dead_product_days} dias', 'Podrias revisar su precio, foto o crear una promocion.', 'info', 44, 2, 'Ver producto', f'/productos?highlight={product.id}', {'product_id': product.id, 'days': settings.dead_product_days}, f'dead_product:business_{business.id}:product_{product.id}'))
    return specs


def evaluate_customer_rules(business, at_datetime):
    settings = ensure_business_settings(business)
    inactive = [customer for customer in get_customers_for_business(business) if customer['orders_count'] >= 3 and (at_datetime - customer['last_order_at']).days >= settings.inactive_customer_days]
    if not inactive:
        return []
    return [_spec('inactive_customer', 'customers', f'{len(inactive)} clientes frecuentes estan inactivos', f'No compran hace mas de {settings.inactive_customer_days} dias.', 'info', 46, 2, 'Ver clientes', '/clientes?filter=recurrentes', {'customers_count': len(inactive)}, f'inactive_customers:business_{business.id}')]


def evaluate_promotion_rules(business, at_datetime):
    specs = []
    soon = at_datetime + timedelta(hours=24)
    for promo in Promocion.objects.filter(negocio=business, active=True):
        if promo.ends_at <= at_datetime:
            specs.append(_spec('promotion_expiring', 'promotions', f'{promo.name} esta vencida y sigue activa', 'Revisala para evitar descuentos fuera de fecha.', 'warning', 64, 3, 'Ver promocion', f'/promociones?highlight={promo.id}', {'promotion_id': promo.id}, f'promotion_expired_active:business_{business.id}:promotion_{promo.id}'))
        elif promo.ends_at <= soon:
            specs.append(_spec('promotion_expiring', 'promotions', f'{promo.name} vence en menos de 24 horas', 'Decidi si queres renovarla, pausarla o reemplazarla.', 'info', 40, 1, 'Ver promocion', f'/promociones?highlight={promo.id}', {'promotion_id': promo.id}, f'promotion_expiring:business_{business.id}:promotion_{promo.id}'))
    return specs


def evaluate_purchase_rules(business, at_datetime):
    specs = []
    increased = (
        PurchaseItem.objects
        .filter(purchase__negocio=business, purchase__status='confirmed', previous_purchase_price__gt=0, new_purchase_price__gt=F('previous_purchase_price'))
        .select_related('ingredient')
        .order_by('-purchase__confirmed_at')[:20]
    )
    for item in increased:
        change = ((item.new_purchase_price - item.previous_purchase_price) / item.previous_purchase_price) * Decimal('100')
        if change >= 15:
            specs.append(_spec('promotion_performance', 'profitability', f'{item.ingredient.name} subio {change.quantize(Decimal("0.1"))}%', 'La ultima compra aumento el costo del insumo y puede afectar margenes.', 'warning', 66, 3, 'Ver costos', '/costos', {'ingredient_id': item.ingredient_id, 'change': str(change)}, f'purchase_cost_increase:business_{business.id}:ingredient_{item.ingredient_id}:purchase_{item.purchase_id}'))
    return specs


def evaluate_operational_rules(business, at_datetime):
    specs = []
    pending = Pedido.objects.filter(negocio=business, status__in=[Pedido.STATUS_PENDING, Pedido.STATUS_ACCEPTED]).count()
    if pending:
        specs.append(_spec('pending_orders', 'operations', f'Tenes {pending} pedidos pendientes de avance', 'Revisalos para que no se acumulen en cocina.', 'warning', 80, 3, 'Ver pedidos', '/pedidos', {'pending_count': pending}, f'pending_orders:business_{business.id}'))
    delayed = []
    for order in Pedido.objects.filter(negocio=business, status__in=[Pedido.STATUS_PENDING, Pedido.STATUS_ACCEPTED, Pedido.STATUS_PREPARING], estimated_minutes__isnull=False):
        if order.created_at + timedelta(minutes=order.estimated_minutes) < at_datetime:
            delayed.append(order.id)
    if delayed:
        specs.append(_spec('preparation_delay', 'operations', f'Hay {len(delayed)} pedidos demorados', 'Superaron el tiempo estimado configurado.', 'critical', 88, 4, 'Ver pedidos', '/pedidos', {'order_ids': delayed}, f'delayed_orders:business_{business.id}'))
    status = get_business_open_status(business, at_datetime)
    if not status['is_open'] and pending:
        specs.append(_spec('pending_orders', 'operations', 'El negocio esta cerrado con pedidos pendientes', 'Conviene resolverlos antes de cerrar la operacion.', 'critical', 86, 4, 'Ver pedidos', '/pedidos', {'pending_count': pending}, f'closed_with_pending:business_{business.id}'))
    return specs


def evaluate_achievement_rules(business, at_datetime):
    today = timezone.localdate()
    start, end = get_day_bounds(today)
    today_sales = Pedido.objects.filter(negocio=business, status__in=ACTIVE_ORDER_STATUSES, created_at__gte=start, created_at__lt=end).aggregate(total=Coalesce(Sum('total'), Decimal('0.00')))['total']
    previous_best = Decimal('0.00')
    for offset in range(1, 29):
        day_start, day_end = get_day_bounds(today - timedelta(days=offset))
        value = Pedido.objects.filter(negocio=business, status__in=ACTIVE_ORDER_STATUSES, created_at__gte=day_start, created_at__lt=day_end).aggregate(total=Coalesce(Sum('total'), Decimal('0.00')))['total']
        previous_best = max(previous_best, value)
    if today_sales > 0 and today_sales > previous_best:
        return [_spec('business_victory', 'achievement', 'Hoy puede ser tu mejor dia de las ultimas 4 semanas', f'Ventas actuales: ${today_sales}.', 'success', 50, 0, 'Ver dashboard', '/dashboard', {'today_sales': str(today_sales), 'previous_best': str(previous_best)}, f'best_day_4w:business_{business.id}:{today}')]
    return []


def all_specs(business, at_datetime):
    return (
        evaluate_stock_rules(business, at_datetime) +
        evaluate_profitability_rules(business, at_datetime) +
        evaluate_sales_rules(business, at_datetime) +
        evaluate_customer_rules(business, at_datetime) +
        evaluate_promotion_rules(business, at_datetime) +
        evaluate_purchase_rules(business, at_datetime) +
        evaluate_operational_rules(business, at_datetime) +
        evaluate_achievement_rules(business, at_datetime)
    )


def _persist_opportunity_specs(business, specs, at_datetime):
    fingerprints = {spec['fingerprint'] for spec in specs}
    now = timezone.now()
    with transaction.atomic():
        existing = {item.fingerprint: item for item in BusinessOpportunity.objects.select_for_update().filter(negocio=business)}
        to_create = []
        to_update = []
        for spec in specs:
            opportunity = existing.get(spec['fingerprint'])
            defaults = {key: value for key, value in spec.items() if key != 'fingerprint'}
            if not opportunity:
                to_create.append(BusinessOpportunity(negocio=business, **spec))
                continue
            for key, value in defaults.items():
                setattr(opportunity, key, value)
            opportunity.active = True
            opportunity.dismissed = False
            opportunity.resolved_at = None
            opportunity.updated_at = now
            to_update.append(opportunity)
        if to_create:
            BusinessOpportunity.objects.bulk_create(to_create, ignore_conflicts=True)
        if to_update:
            BusinessOpportunity.objects.bulk_update(to_update, OPPORTUNITY_UPDATE_FIELDS)
        stale = BusinessOpportunity.objects.filter(negocio=business, active=True).exclude(fingerprint__in=fingerprints)
        stale.update(active=False, resolved_at=at_datetime, updated_at=now)
    return BusinessOpportunity.objects.filter(negocio=business).order_by('-priority', '-created_at')


def generate_business_opportunities(business, at_datetime=None, max_attempts=3):
    at_datetime = at_datetime or timezone.now()
    specs = all_specs(business, at_datetime)
    for attempt in range(max_attempts):
        try:
            return _persist_opportunity_specs(business, specs, at_datetime)
        except OperationalError as exc:
            if 'database is locked' not in str(exc).lower() or attempt >= max_attempts - 1:
                raise OpportunityGenerationBusy('La base de datos esta ocupada generando oportunidades. Intenta nuevamente en unos segundos.') from exc
            time.sleep(0.15 * (attempt + 1))


def calculate_business_health_score(business, at_datetime=None):
    at_datetime = at_datetime or timezone.now()
    settings = ensure_business_settings(business)
    products = list(Producto.objects.filter(negocio=business, available=True).prefetch_related('recipe_items__ingredient'))
    ingredients = list(Ingredient.objects.filter(negocio=business, active=True))
    delayed_count = 0
    for order in Pedido.objects.filter(negocio=business, status__in=[Pedido.STATUS_PENDING, Pedido.STATUS_ACCEPTED, Pedido.STATUS_PREPARING], estimated_minutes__isnull=False):
        if order.created_at + timedelta(minutes=order.estimated_minutes) < at_datetime:
            delayed_count += 1
    pending_old = Pedido.objects.filter(negocio=business, status__in=[Pedido.STATUS_PENDING, Pedido.STATUS_ACCEPTED], created_at__lt=at_datetime - timedelta(minutes=30)).count()

    negative = low_margin = incomplete = no_cost = 0
    for product in products:
        data = calculate_product_cost(product)
        if data['recipe_cost'] > data['sale_price'] and data['recipe_cost'] > 0:
            negative += 1
        if data['margin_percentage'] is not None and data['margin_percentage'] < settings.low_margin_threshold:
            low_margin += 1
        if data['ingredients_count'] == 0 or data['missing_costs']:
            incomplete += 1
        if data['recipe_cost'] <= 0:
            no_cost += 1
    out = len([ingredient for ingredient in ingredients if ingredient.current_stock <= 0])
    low = len([ingredient for ingredient in ingredients if ingredient.current_stock <= ingredient.minimum_stock])

    breakdown = {
        'profitability': min(negative * 8, 24) + min(low_margin * 3, 15) + min(incomplete * 2, 10),
        'stock': min(out * 6, 18) + min(low * 2, 10),
        'operations': min(delayed_count * 3, 15) + min(pending_old * 2, 10),
        'configuration': (0 if settings.whatsapp_number else 5),
        'products': min(no_cost * 2, 10),
        'sales': 0,
    }
    penalties = sum(breakdown.values())
    score = max(0, min(100, 100 - penalties))
    label = 'Excelente' if score >= 90 else 'Buena' if score >= 75 else 'Atencion' if score >= 50 else 'Critica'
    actions = []
    if low:
        actions.append({'label': 'Reponer insumos con stock bajo', 'points': min(low * 2, 10), 'url': '/inventario'})
    if incomplete:
        actions.append({'label': f'Completar {incomplete} recetas o costos', 'points': min(incomplete * 2, 10), 'url': '/productos'})
    if negative or low_margin:
        actions.append({'label': 'Revisar productos con margen bajo', 'points': min(negative * 8, 24) + min(low_margin * 3, 15), 'url': '/costos'})
    if delayed_count:
        actions.append({'label': 'Resolver pedidos demorados', 'points': min(delayed_count * 3, 15), 'url': '/pedidos'})
    if not settings.whatsapp_number:
        actions.append({'label': 'Configurar WhatsApp de pedidos', 'points': 5, 'url': '/configuracion'})
    return {
        'score': score,
        'label': label,
        'breakdown': breakdown,
        'actions': actions,
        'points_recoverable': sum(action['points'] for action in actions),
        'generated_at': at_datetime,
    }
