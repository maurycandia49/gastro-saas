from datetime import datetime, time, timedelta
from decimal import Decimal

from django.db.models import Count, F, Sum
from django.db.models.functions import Coalesce, ExtractHour
from django.utils import timezone

from .models import DetallePedido, Pedido


ACTIVE_ORDER_STATUSES = [
    Pedido.STATUS_PENDING,
    Pedido.STATUS_ACCEPTED,
    Pedido.STATUS_PREPARING,
    Pedido.STATUS_READY,
    Pedido.STATUS_DELIVERED,
]


def get_day_bounds(day):
    current_timezone = timezone.get_current_timezone()
    start = timezone.make_aware(datetime.combine(day, time.min), current_timezone)
    end = start + timedelta(days=1)
    return start, end


def base_orders_for_business(user, business_id):
    return Pedido.objects.filter(negocio_id=business_id, negocio__user=user)


def calculate_order_totals(queryset):
    summary = queryset.aggregate(
        sales_total=Coalesce(Sum('total'), Decimal('0.00')),
        orders_count=Count('id'),
    )
    sales_total = summary['sales_total']
    orders_count = summary['orders_count']
    average_ticket = sales_total / orders_count if orders_count else Decimal('0.00')
    return sales_total, orders_count, average_ticket


def get_summary_metrics(user, business_id, period='today'):
    if period != 'today':
        period = 'today'

    today = timezone.localdate()
    yesterday = today - timedelta(days=1)
    start, end = get_day_bounds(today)
    previous_start, previous_end = get_day_bounds(yesterday)

    business_orders = base_orders_for_business(user, business_id)
    current_orders = business_orders.filter(created_at__gte=start, created_at__lt=end)
    current_sales_orders = current_orders.filter(status__in=ACTIVE_ORDER_STATUSES)
    previous_sales_orders = business_orders.filter(
        created_at__gte=previous_start,
        created_at__lt=previous_end,
        status__in=ACTIVE_ORDER_STATUSES,
    )

    sales_total, orders_count, average_ticket = calculate_order_totals(current_sales_orders)
    previous_sales_total, previous_orders_count, _ = calculate_order_totals(previous_sales_orders)

    items_queryset = DetallePedido.objects.filter(pedido__in=current_sales_orders)
    items_sold = items_queryset.aggregate(total=Coalesce(Sum('quantity'), 0))['total']

    top_product_data = (
        items_queryset
        .values(product_id=F('producto_id'), name=F('product_name'))
        .annotate(quantity=Sum('quantity'), revenue=Sum('subtotal'))
        .order_by('-quantity', '-revenue', 'name')
        .first()
    )
    top_product = None
    if top_product_data:
        top_product = {
            'product_id': top_product_data['product_id'],
            'name': top_product_data['name'],
            'quantity': top_product_data['quantity'],
            'revenue': top_product_data['revenue'],
        }

    orders_by_status = {status: 0 for status, _ in Pedido.STATUS_CHOICES}
    for row in current_orders.values('status').annotate(count=Count('id')):
        orders_by_status[row['status']] = row['count']

    last_orders = [
        {
            'id': order.id,
            'customer_name': order.customer_name,
            'total': order.total,
            'status': order.status,
            'created_at': order.created_at,
        }
        for order in business_orders.only('id', 'customer_name', 'total', 'status', 'created_at').order_by('-created_at')[:5]
    ]

    if previous_sales_total:
        sales_change_percentage = ((sales_total - previous_sales_total) / previous_sales_total) * Decimal('100')
    else:
        sales_change_percentage = None

    return {
        'sales_total': sales_total,
        'orders_count': orders_count,
        'average_ticket': average_ticket,
        'items_sold': items_sold,
        'top_product': top_product,
        'previous_period': {
            'sales_total': previous_sales_total,
            'orders_count': previous_orders_count,
        },
        'sales_change_percentage': sales_change_percentage,
        'orders_by_status': orders_by_status,
        'last_orders': last_orders,
    }


def get_hourly_sales(user, business_id, day):
    start, end = get_day_bounds(day)
    rows = (
        base_orders_for_business(user, business_id)
        .filter(created_at__gte=start, created_at__lt=end, status__in=ACTIVE_ORDER_STATUSES)
        .annotate(hour=ExtractHour('created_at'))
        .values('hour')
        .annotate(sales_total=Coalesce(Sum('total'), Decimal('0.00')), orders_count=Count('id'))
        .order_by('hour')
    )
    by_hour = {row['hour']: row for row in rows}
    return [
        {
            'hour': hour,
            'sales_total': by_hour.get(hour, {}).get('sales_total', Decimal('0.00')),
            'orders_count': by_hour.get(hour, {}).get('orders_count', 0),
        }
        for hour in range(24)
    ]


def _margin(profit, sales):
    if not sales:
        return None
    return (profit / sales) * Decimal('100')


def get_profit_metrics(user, business_id, period='today'):
    if period != 'today':
        period = 'today'

    start, end = get_day_bounds(timezone.localdate())
    sales_orders = base_orders_for_business(user, business_id).filter(
        created_at__gte=start,
        created_at__lt=end,
        status__in=ACTIVE_ORDER_STATUSES,
    )
    items = DetallePedido.objects.filter(pedido__in=sales_orders)

    totals = items.aggregate(
        sales=Coalesce(Sum('subtotal'), Decimal('0.00')),
        costs=Coalesce(Sum('subtotal_cost'), Decimal('0.00')),
        gross_profit=Coalesce(Sum('profit'), Decimal('0.00')),
    )
    sales = totals['sales']
    gross_profit = totals['gross_profit']

    product_rows = (
        items
        .values(product_id=F('producto_id'), name=F('product_name'))
        .annotate(
            sales=Coalesce(Sum('subtotal'), Decimal('0.00')),
            costs=Coalesce(Sum('subtotal_cost'), Decimal('0.00')),
            profit=Coalesce(Sum('profit'), Decimal('0.00')),
        )
    )
    products = [
        {
            'product_id': row['product_id'],
            'name': row['name'],
            'sales': row['sales'],
            'costs': row['costs'],
            'profit': row['profit'],
            'margin': _margin(row['profit'], row['sales']),
        }
        for row in product_rows
        if row['costs'] > 0
    ]
    top_product = max(products, key=lambda row: (row['profit'], row['margin'] or Decimal('0.00')), default=None)
    least_product = min(products, key=lambda row: (row['profit'], row['margin'] or Decimal('0.00')), default=None)
    margins = [product['margin'] for product in products if product['margin'] is not None]
    average_margin = sum(margins, Decimal('0.00')) / len(margins) if margins else None

    return {
        'sales': sales,
        'costs': totals['costs'],
        'gross_profit': gross_profit,
        'profit_margin': _margin(gross_profit, sales),
        'average_margin': average_margin,
        'top_profitable_product': top_product,
        'least_profitable_product': least_product,
    }
