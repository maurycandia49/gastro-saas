import re
from decimal import Decimal

from django.db.models import Count, Sum
from django.db.models.functions import Coalesce

from negocios.models import Negocio
from .metrics import ACTIVE_ORDER_STATUSES
from .models import DetallePedido, Pedido


def normalize_phone(value):
    return re.sub(r'\D+', '', value or '')


def get_business_for_user(user, business_id):
    if not business_id:
        return None
    try:
        return Negocio.objects.get(pk=business_id, user=user)
    except Negocio.DoesNotExist:
        return None


def _base_customer_orders(business):
    return (
        Pedido.objects
        .filter(negocio=business, status__in=ACTIVE_ORDER_STATUSES)
        .exclude(customer_phone='')
        .only('id', 'customer_name', 'customer_phone', 'delivery_address', 'total', 'status', 'created_at')
        .order_by('-created_at')
    )


def build_customer_summary(phone, orders):
    sorted_orders = sorted(orders, key=lambda order: order.created_at, reverse=True)
    total_spent = sum((order.total for order in sorted_orders), Decimal('0.00'))
    orders_count = len(sorted_orders)
    average_ticket = total_spent / orders_count if orders_count else Decimal('0.00')
    first_order = sorted_orders[-1]
    last_order = sorted_orders[0]
    return {
        'phone': phone,
        'name': last_order.customer_name,
        'orders_count': orders_count,
        'total_spent': total_spent,
        'average_ticket': average_ticket,
        'first_order_at': first_order.created_at,
        'last_order_at': last_order.created_at,
        'last_delivery_address': last_order.delivery_address,
        'is_recurring': orders_count >= 2,
        'is_vip': False,
    }


def get_customers_for_business(business):
    grouped = {}
    for order in _base_customer_orders(business):
        phone = normalize_phone(order.customer_phone)
        if not phone:
            continue
        grouped.setdefault(phone, []).append(order)

    customers = [build_customer_summary(phone, orders) for phone, orders in grouped.items()]
    customers.sort(key=lambda customer: customer['total_spent'], reverse=True)
    vip_phones = {customer['phone'] for customer in customers[:10]}
    for customer in customers:
        customer['is_vip'] = customer['phone'] in vip_phones
    return customers


def get_customer_detail(business, phone):
    normalized_phone = normalize_phone(phone)
    customers = get_customers_for_business(business)
    summary = next((customer for customer in customers if customer['phone'] == normalized_phone), None)
    if not summary:
        return None

    matching_orders = [
        order
        for order in _base_customer_orders(business).prefetch_related('items')
        if normalize_phone(order.customer_phone) == normalized_phone
    ]
    matching_orders.sort(key=lambda order: order.created_at, reverse=True)
    order_ids = [order.id for order in matching_orders]

    favorite_products = list(
        DetallePedido.objects
        .filter(pedido_id__in=order_ids)
        .values('product_name')
        .annotate(quantity=Coalesce(Sum('quantity'), 0), total_spent=Coalesce(Sum('subtotal'), Decimal('0.00')))
        .order_by('-quantity', '-total_spent', 'product_name')[:5]
    )
    addresses = []
    for order in matching_orders:
        if order.delivery_address and order.delivery_address not in addresses:
            addresses.append(order.delivery_address)

    if summary['orders_count'] >= 2:
        days = (summary['last_order_at'] - summary['first_order_at']).days
        frequency_days = days / (summary['orders_count'] - 1) if days > 0 else 0
    else:
        frequency_days = None

    return {
        **summary,
        'frequency_days': frequency_days,
        'orders': [
            {
                'id': order.id,
                'customer_name': order.customer_name,
                'total': order.total,
                'status': order.status,
                'created_at': order.created_at,
                'delivery_address': order.delivery_address,
                'items_count': sum(item.quantity for item in order.items.all()),
            }
            for order in matching_orders
        ],
        'favorite_products': favorite_products,
        'addresses': addresses,
    }
