from decimal import Decimal, ROUND_HALF_UP

from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from inventory.models import Ingredient, InventoryMovement
from inventory.services import increase_stock
from recetas.conversions import convert_quantity, validate_compatible_units
from recetas.costing import register_ingredient_cost_change, recalculate_products_using_ingredient
from .models import Purchase, PurchaseItem


MONEY = Decimal('0.01')


def quantize_money(value):
    return Decimal(value).quantize(MONEY, rounding=ROUND_HALF_UP)


def _decimal_or_none(value):
    if value in {None, ''}:
        return None
    return Decimal(value)


def calculate_item_values(item):
    has_package_data = (
        _decimal_or_none(getattr(item, 'package_quantity', None)) is not None
        or _decimal_or_none(getattr(item, 'content_per_package', None)) is not None
        or bool(getattr(item, 'content_unit', ''))
        or Decimal(getattr(item, 'total_price', 0) or 0) > 0
    )

    if has_package_data:
        package_quantity = _decimal_or_none(item.package_quantity)
        content_per_package = _decimal_or_none(item.content_per_package)
        content_unit = item.content_unit or item.ingredient.unit
        total_price = Decimal(item.total_price or 0)
        if package_quantity is None or package_quantity <= 0:
            raise serializers.ValidationError({'package_quantity': 'La cantidad de envases debe ser mayor que cero.'})
        if content_per_package is None or content_per_package <= 0:
            raise serializers.ValidationError({'content_per_package': 'El contenido por envase debe ser mayor que cero.'})
        if total_price < 0:
            raise serializers.ValidationError({'total_price': 'El precio total de la linea no puede ser negativo.'})
        validate_compatible_units(content_unit, item.ingredient.unit)
        total_content = package_quantity * content_per_package
        quantity_in_stock_unit = convert_quantity(total_content, content_unit, item.ingredient.unit)
        if quantity_in_stock_unit <= 0:
            raise serializers.ValidationError({'total_content_in_stock_unit': 'La cantidad que ingresa al stock debe ser mayor que cero.'})
        unit_cost = quantize_money(total_price / quantity_in_stock_unit) if quantity_in_stock_unit else Decimal('0.00')
        item.quantity = total_content
        item.unit = content_unit
        item.unit_price = quantize_money(total_price / total_content) if total_content else Decimal('0.00')
        item.subtotal = quantize_money(total_price)
        item.total_price = quantize_money(total_price)
        item.total_content_in_stock_unit = quantity_in_stock_unit
        item.unit_cost_in_stock_unit = unit_cost
        return quantity_in_stock_unit, item.subtotal, unit_cost

    validate_compatible_units(item.unit, item.ingredient.unit)
    quantity_in_stock_unit = convert_quantity(item.quantity, item.unit, item.ingredient.unit)
    subtotal = quantize_money(item.quantity * item.unit_price)
    if quantity_in_stock_unit <= 0:
        raise serializers.ValidationError({'quantity': 'La cantidad debe ser mayor que cero.'})
    new_purchase_price = quantize_money(subtotal / quantity_in_stock_unit) if quantity_in_stock_unit else Decimal('0.00')
    item.package_quantity = Decimal('1.000')
    item.package_type = PurchaseItem.PACKAGE_UNIT
    item.content_per_package = item.quantity
    item.content_unit = item.unit
    item.total_content_in_stock_unit = quantity_in_stock_unit
    item.total_price = subtotal
    item.unit_cost_in_stock_unit = new_purchase_price
    return quantity_in_stock_unit, subtotal, new_purchase_price


def recalculate_purchase_totals(purchase):
    subtotal = sum((item.subtotal for item in purchase.items.all()), Decimal('0.00'))
    total = quantize_money(subtotal + purchase.taxes - purchase.discounts)
    if total < 0:
        raise serializers.ValidationError({'total': 'El total no puede ser negativo.'})
    purchase.subtotal = quantize_money(subtotal)
    purchase.total = total
    purchase.save(update_fields=['subtotal', 'total', 'updated_at'])
    return purchase


@transaction.atomic
def confirm_purchase(purchase, user):
    purchase = Purchase.objects.select_for_update().get(pk=purchase.pk)
    if purchase.status != Purchase.STATUS_DRAFT:
        raise serializers.ValidationError({'status': 'Solo se pueden confirmar compras en borrador.'})
    items = list(purchase.items.select_related('ingredient'))
    if not items:
        raise serializers.ValidationError({'items': 'La compra no tiene líneas guardadas. El frontend debe enviar al menos una línea confirmada con insumo asociado.'})
    Ingredient.objects.select_for_update().filter(id__in=[item.ingredient_id for item in items])

    impact = {'ingredients_updated': [], 'movements_created': 0, 'affected_products_count': 0, 'alerts_created': 0}
    for item in items:
        ingredient = Ingredient.objects.select_for_update().get(pk=item.ingredient_id)
        item.ingredient = ingredient
        quantity_in_stock_unit, subtotal, new_purchase_price = calculate_item_values(item)
        previous_stock = ingredient.current_stock
        previous_price = ingredient.purchase_price
        movement = increase_stock(
            ingredient,
            quantity_in_stock_unit,
            movement_type=InventoryMovement.TYPE_PURCHASE,
            notes=f'Compra #{purchase.id} - {purchase.supplier.name if purchase.supplier else "Sin proveedor"}',
            user=user,
        )
        ingredient.refresh_from_db()
        ingredient.purchase_price = new_purchase_price
        ingredient.save(update_fields=['purchase_price', 'updated_at'])
        register_ingredient_cost_change(ingredient, previous_price, new_purchase_price, user=user, source='purchase', notes=f'Compra #{purchase.id}')
        affected = recalculate_products_using_ingredient(ingredient)
        item.quantity_in_stock_unit = quantity_in_stock_unit
        item.subtotal = subtotal
        item.previous_purchase_price = previous_price
        item.new_purchase_price = new_purchase_price
        item.description_snapshot = item.description_snapshot or ingredient.name
        item.save(update_fields=['package_quantity', 'package_type', 'content_per_package', 'content_unit', 'total_content_in_stock_unit', 'total_price', 'unit_cost_in_stock_unit', 'quantity', 'unit', 'unit_price', 'quantity_in_stock_unit', 'subtotal', 'previous_purchase_price', 'new_purchase_price', 'description_snapshot'])
        impact['movements_created'] += 1 if movement else 0
        impact['affected_products_count'] += len(affected)
        impact['alerts_created'] += sum(row.get('alerts_created', 0) for row in affected)
        impact['ingredients_updated'].append({
            'ingredient_id': ingredient.id,
            'name': ingredient.name,
            'unit': ingredient.unit,
            'previous_stock': previous_stock,
            'new_stock': ingredient.current_stock,
            'previous_price': previous_price,
            'new_price': new_purchase_price,
            'affected_products': affected,
        })
    recalculate_purchase_totals(purchase)
    purchase.status = Purchase.STATUS_CONFIRMED
    purchase.confirmed_at = timezone.now()
    purchase.confirmed_by = user
    purchase.save(update_fields=['status', 'confirmed_at', 'confirmed_by', 'updated_at'])
    return purchase, impact
