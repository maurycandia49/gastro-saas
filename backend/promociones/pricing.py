from decimal import Decimal

from django.utils import timezone

from .models import Promocion


def _promotion_price(product, promotion):
    original_price = Decimal(product.price)
    if promotion.promotion_type == Promocion.TYPE_PERCENTAGE:
        discount = original_price * (promotion.percentage_discount / Decimal('100.00'))
        final_price = original_price - discount
    else:
        final_price = promotion.fixed_price
        discount = original_price - final_price

    if final_price < 0:
        final_price = Decimal('0.00')
    if discount < 0:
        discount = Decimal('0.00')
    return final_price, discount


def get_effective_price(product, at_datetime=None):
    current = at_datetime or timezone.now()
    promotions = Promocion.objects.filter(
        negocio_id=product.negocio_id,
        active=True,
        starts_at__lte=current,
        ends_at__gte=current,
    ).filter(
        producto_id=product.id,
    ) | Promocion.objects.filter(
        negocio_id=product.negocio_id,
        active=True,
        starts_at__lte=current,
        ends_at__gte=current,
        categoria_id=product.categoria_id,
    )

    best = None
    for promotion in promotions.distinct():
        final_price, discount = _promotion_price(product, promotion)
        if best is None or final_price < best['final_price']:
            best = {
                'original_price': product.price,
                'final_price': final_price,
                'discount_amount': discount,
                'promotion_id': promotion.id,
                'promotion_name': promotion.name,
                'promotion_featured': promotion.featured,
                'discount_percentage': promotion.percentage_discount if promotion.promotion_type == Promocion.TYPE_PERCENTAGE else None,
            }

    if best:
        return best
    return {
        'original_price': product.price,
        'final_price': product.price,
        'discount_amount': Decimal('0.00'),
        'promotion_id': None,
        'promotion_name': '',
        'promotion_featured': False,
        'discount_percentage': None,
    }
