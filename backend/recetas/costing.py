from decimal import Decimal, ROUND_HALF_UP

from django.db import transaction
from django.db.models import Prefetch
from django.utils import timezone
from rest_framework import serializers

from negocios.operations import ensure_business_settings
from productos.models import Producto
from .models import IngredientCostHistory, ProductCostSnapshot, ProfitabilityAlert, RecipeIngredient
from .services import calculate_available_units, effective_consumption


MONEY = Decimal('0.01')
PERCENT = Decimal('0.01')


def quantize_money(value):
    return Decimal(value).quantize(MONEY, rounding=ROUND_HALF_UP)


def quantize_percent(value):
    if value is None:
        return None
    return Decimal(value).quantize(PERCENT, rounding=ROUND_HALF_UP)


def calculate_product_cost(product):
    items = list(product.recipe_items.select_related('ingredient'))
    total = Decimal('0.00')
    missing_costs = []
    breakdown = []

    for item in items:
        ingredient = item.ingredient
        effective_quantity = effective_consumption(item)
        purchase_price = ingredient.purchase_price or Decimal('0.00')
        calculated_cost = effective_quantity * purchase_price
        total += calculated_cost
        if purchase_price <= 0:
            missing_costs.append(ingredient.name)
        breakdown.append({
            'ingredient_id': ingredient.id,
            'ingredient_name': ingredient.name,
            'recipe_quantity': item.quantity,
            'recipe_unit': item.unit,
            'stock_unit': ingredient.unit,
            'effective_quantity': effective_quantity,
            'waste_percentage': item.waste_percentage,
            'purchase_price': purchase_price,
            'calculated_cost': calculated_cost,
            'percentage_of_total_cost': None,
        })

    total = quantize_money(total)
    for row in breakdown:
        row['calculated_cost'] = quantize_money(row['calculated_cost'])
        if total > 0:
            row['percentage_of_total_cost'] = quantize_percent((row['calculated_cost'] / total) * Decimal('100'))

    sale_price = quantize_money(product.price)
    unit_profit = quantize_money(sale_price - total)
    margin = quantize_percent((unit_profit / sale_price) * Decimal('100')) if sale_price > 0 and total > 0 else None
    markup = quantize_percent((unit_profit / total) * Decimal('100')) if total > 0 else None

    return {
        'recipe_cost': total,
        'sale_price': sale_price,
        'unit_profit': unit_profit,
        'margin_percentage': margin,
        'markup_percentage': markup,
        'ingredients_count': len(items),
        'missing_costs': missing_costs,
        'incomplete_recipe': len(items) == 0 or bool(missing_costs),
        'cost_breakdown': breakdown,
    }


def create_snapshot_if_changed(product, trigger=ProductCostSnapshot.TRIGGER_MANUAL):
    data = calculate_product_cost(product)
    latest = product.cost_snapshots.order_by('-calculated_at').first()
    comparable = {
        'recipe_cost': data['recipe_cost'],
        'sale_price': data['sale_price'],
        'unit_profit': data['unit_profit'],
        'margin_percentage': data['margin_percentage'],
        'markup_percentage': data['markup_percentage'],
        'ingredients_count': data['ingredients_count'],
        'incomplete_recipe': data['incomplete_recipe'],
    }
    if latest and all(getattr(latest, key) == value for key, value in comparable.items()):
        return latest, False
    snapshot = ProductCostSnapshot.objects.create(producto=product, trigger=trigger, **comparable)
    return snapshot, True


def _active_alert(product, alert_type, title, message, severity, previous_value=None, current_value=None):
    alert, created = ProfitabilityAlert.objects.get_or_create(
        negocio=product.negocio,
        producto=product,
        alert_type=alert_type,
        resolved=False,
        defaults={
            'title': title,
            'message': message,
            'severity': severity,
            'previous_value': previous_value,
            'current_value': current_value,
        },
    )
    if not created:
        alert.title = title
        alert.message = message
        alert.severity = severity
        alert.previous_value = previous_value
        alert.current_value = current_value
        alert.save(update_fields=['title', 'message', 'severity', 'previous_value', 'current_value'])
    return alert, created


def _resolve_alert(product, alert_type):
    now = timezone.now()
    ProfitabilityAlert.objects.filter(
        negocio=product.negocio,
        producto=product,
        alert_type=alert_type,
        resolved=False,
    ).update(resolved=True, resolved_at=now)


def recalculate_product_alerts(product, previous_recipe_cost=None):
    settings = ensure_business_settings(product.negocio)
    data = calculate_product_cost(product)
    created = []

    if data['ingredients_count'] == 0:
        alert, was_created = _active_alert(
            product,
            ProfitabilityAlert.TYPE_INCOMPLETE_RECIPE,
            'Receta incompleta',
            f'{product.name} todavia no tiene receta cargada.',
            ProfitabilityAlert.SEVERITY_WARNING,
            current_value=data['recipe_cost'],
        )
        if was_created:
            created.append(alert)
    else:
        _resolve_alert(product, ProfitabilityAlert.TYPE_INCOMPLETE_RECIPE)

    if data['missing_costs']:
        alert, was_created = _active_alert(
            product,
            ProfitabilityAlert.TYPE_MISSING_INGREDIENT_COST,
            'Insumo sin costo',
            f'{product.name} usa insumos sin costo: {", ".join(data["missing_costs"])}.',
            ProfitabilityAlert.SEVERITY_WARNING,
            current_value=data['recipe_cost'],
        )
        if was_created:
            created.append(alert)
    else:
        _resolve_alert(product, ProfitabilityAlert.TYPE_MISSING_INGREDIENT_COST)

    if data['recipe_cost'] > data['sale_price'] and data['recipe_cost'] > 0:
        alert, was_created = _active_alert(
            product,
            ProfitabilityAlert.TYPE_NEGATIVE_PROFIT,
            'Ganancia negativa',
            f'{product.name} cuesta mas de lo que vende.',
            ProfitabilityAlert.SEVERITY_CRITICAL,
            current_value=data['unit_profit'],
        )
        if was_created:
            created.append(alert)
    else:
        _resolve_alert(product, ProfitabilityAlert.TYPE_NEGATIVE_PROFIT)

    margin = data['margin_percentage']
    if margin is not None and margin < settings.low_margin_threshold:
        alert, was_created = _active_alert(
            product,
            ProfitabilityAlert.TYPE_MARGIN_LOW,
            'Margen bajo',
            f'{product.name} tiene margen {margin}% por debajo del limite {settings.low_margin_threshold}%.',
            ProfitabilityAlert.SEVERITY_WARNING,
            current_value=margin,
        )
        if was_created:
            created.append(alert)
    else:
        _resolve_alert(product, ProfitabilityAlert.TYPE_MARGIN_LOW)

    if previous_recipe_cost and previous_recipe_cost > 0 and data['recipe_cost'] > previous_recipe_cost:
        increase = ((data['recipe_cost'] - previous_recipe_cost) / previous_recipe_cost) * Decimal('100')
        if increase >= settings.cost_increase_alert_percentage:
            alert, was_created = _active_alert(
                product,
                ProfitabilityAlert.TYPE_COST_INCREASE,
                'Aumento de costo',
                f'El costo de {product.name} aumento {quantize_percent(increase)}%.',
                ProfitabilityAlert.SEVERITY_WARNING,
                previous_value=quantize_money(previous_recipe_cost),
                current_value=data['recipe_cost'],
            )
            if was_created:
                created.append(alert)
        else:
            _resolve_alert(product, ProfitabilityAlert.TYPE_COST_INCREASE)

    return created


@transaction.atomic
def register_ingredient_cost_change(ingredient, previous_price, new_price, user=None, source=IngredientCostHistory.SOURCE_MANUAL, notes=''):
    if previous_price == new_price:
        return None
    return IngredientCostHistory.objects.create(
        ingredient=ingredient,
        previous_price=previous_price,
        new_price=new_price,
        changed_by=user,
        source=source,
        notes=notes,
    )


def recalculate_products_using_ingredient(ingredient):
    products = (
        Producto.objects
        .filter(recipe_items__ingredient=ingredient)
        .select_related('negocio', 'categoria')
        .prefetch_related(Prefetch('recipe_items', queryset=RecipeIngredient.objects.select_related('ingredient')))
        .distinct()
    )
    affected = []
    for product in products:
        previous_snapshot = product.cost_snapshots.order_by('-calculated_at').first()
        previous_cost = previous_snapshot.recipe_cost if previous_snapshot else None
        snapshot, _ = create_snapshot_if_changed(product, ProductCostSnapshot.TRIGGER_INGREDIENT_COST_CHANGE)
        alerts = recalculate_product_alerts(product, previous_cost)
        current = calculate_product_cost(product)
        if previous_cost is not None and previous_cost > 0:
            cost_change = current['recipe_cost'] - previous_cost
            cost_change_percentage = quantize_percent((cost_change / previous_cost) * Decimal('100'))
        else:
            cost_change = current['recipe_cost']
            cost_change_percentage = None
        affected.append({
            'product_id': product.id,
            'name': product.name,
            'previous_cost': previous_cost,
            'current_cost': current['recipe_cost'],
            'cost_change': quantize_money(cost_change),
            'cost_change_percentage': cost_change_percentage,
            'previous_margin': previous_snapshot.margin_percentage if previous_snapshot else None,
            'current_margin': current['margin_percentage'],
            'margin_points_lost': quantize_percent((previous_snapshot.margin_percentage - current['margin_percentage'])) if previous_snapshot and previous_snapshot.margin_percentage is not None and current['margin_percentage'] is not None else None,
            'suggested_price': _safe_suggested_price(product),
            'snapshot_id': snapshot.id,
            'alerts_created': len(alerts),
        })
    return affected


def calculate_suggested_price(product, target_margin):
    target_margin = Decimal(str(target_margin))
    if target_margin <= 0 or target_margin >= 100:
        raise serializers.ValidationError({'target_margin': 'El margen objetivo debe ser mayor a 0 y menor a 100.'})
    data = calculate_product_cost(product)
    if data['incomplete_recipe']:
        raise serializers.ValidationError({'recipe': 'El producto debe tener una receta completa.'})
    if data['recipe_cost'] <= 0:
        raise serializers.ValidationError({'recipe_cost': 'El costo debe ser mayor que cero.'})
    suggested = quantize_money(data['recipe_cost'] / (Decimal('1') - target_margin / Decimal('100')))
    difference = quantize_money(suggested - data['sale_price'])
    increase = quantize_percent((difference / data['sale_price']) * Decimal('100')) if data['sale_price'] > 0 else None
    return {
        'current_price': data['sale_price'],
        'recipe_cost': data['recipe_cost'],
        'target_margin': quantize_percent(target_margin),
        'suggested_price': suggested,
        'price_difference': difference,
        'percentage_increase': increase,
        'projected_unit_profit': quantize_money(suggested - data['recipe_cost']),
    }


def _safe_suggested_price(product):
    try:
        settings = ensure_business_settings(product.negocio)
        return calculate_suggested_price(product, settings.target_margin_percentage)
    except serializers.ValidationError:
        return None


def ingredient_cost_impact(ingredient):
    history = ingredient.cost_history.first()
    previous_price = history.previous_price if history else None
    new_price = ingredient.purchase_price
    variation = None
    if previous_price and previous_price > 0:
        variation = quantize_percent(((new_price - previous_price) / previous_price) * Decimal('100'))
    return {
        'ingredient': {
            'id': ingredient.id,
            'name': ingredient.name,
            'unit': ingredient.unit,
        },
        'previous_price': previous_price,
        'current_price': new_price,
        'variation_percentage': variation,
        'affected_products': recalculate_products_using_ingredient(ingredient),
    }


def costing_summary(user, business_id):
    products = (
        Producto.objects
        .filter(negocio_id=business_id, negocio__user=user)
        .select_related('negocio', 'categoria')
        .prefetch_related(Prefetch('recipe_items', queryset=RecipeIngredient.objects.select_related('ingredient')))
    )
    rows = []
    for product in products:
        data = calculate_product_cost(product)
        rows.append({'product': product, **data})
    complete = [row for row in rows if not row['incomplete_recipe']]
    margins = [row['margin_percentage'] for row in complete if row['margin_percentage'] is not None]
    low_margin = [row for row in complete if row['margin_percentage'] is not None and row['margin_percentage'] < ensure_business_settings(row['product'].negocio).low_margin_threshold]
    negative = [row for row in rows if row['unit_profit'] < 0 and row['recipe_cost'] > 0]
    estimated_catalog_profit = sum((row['unit_profit'] for row in complete), Decimal('0.00'))
    most = max(complete, key=lambda row: row['unit_profit'], default=None)
    least = min(complete, key=lambda row: row['unit_profit'], default=None)
    return {
        'products_count': len(rows),
        'products_with_complete_recipe': len(complete),
        'products_without_recipe': len([row for row in rows if row['ingredients_count'] == 0]),
        'products_with_low_margin': len(low_margin),
        'products_with_negative_profit': len(negative),
        'average_margin': quantize_percent(sum(margins, Decimal('0.00')) / len(margins)) if margins else None,
        'estimated_catalog_profit': quantize_money(estimated_catalog_profit),
        'estimated_catalog_profit_definition': 'Suma de la ganancia unitaria estimada de una unidad de cada producto con receta completa; no es ganancia real de ventas.',
        'most_profitable_product': _summary_product(most),
        'least_profitable_product': _summary_product(least),
        'active_alerts_count': ProfitabilityAlert.objects.filter(negocio_id=business_id, negocio__user=user, resolved=False).count(),
    }


def _summary_product(row):
    if not row:
        return None
    return {
        'product_id': row['product'].id,
        'name': row['product'].name,
        'unit_profit': row['unit_profit'],
        'margin_percentage': row['margin_percentage'],
    }


def product_cost_payload(product):
    data = calculate_product_cost(product)
    availability = calculate_available_units(product)
    settings = ensure_business_settings(product.negocio)
    suggested = None
    try:
        suggested = calculate_suggested_price(product, settings.target_margin_percentage)
    except serializers.ValidationError:
        suggested = None
    active_alerts = product.profitability_alerts.filter(resolved=False)
    return {
        'product_id': product.id,
        'name': product.name,
        'category': product.categoria.name if product.categoria_id else '',
        'price': product.price,
        **data,
        **availability,
        'suggested_price': suggested,
        'active_alerts': [
            {
                'id': alert.id,
                'type': alert.alert_type,
                'title': alert.title,
                'message': alert.message,
                'severity': alert.severity,
                'read': alert.read,
            }
            for alert in active_alerts
        ],
        'snapshots': [
            {
                'id': snapshot.id,
                'recipe_cost': snapshot.recipe_cost,
                'sale_price': snapshot.sale_price,
                'unit_profit': snapshot.unit_profit,
                'margin_percentage': snapshot.margin_percentage,
                'markup_percentage': snapshot.markup_percentage,
                'trigger': snapshot.trigger,
                'calculated_at': snapshot.calculated_at,
            }
            for snapshot in product.cost_snapshots.all()[:20]
        ],
    }
