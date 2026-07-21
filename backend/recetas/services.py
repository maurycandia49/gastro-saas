from decimal import Decimal, ROUND_FLOOR

from django.db import transaction
from rest_framework import serializers

from inventory.models import Ingredient, InventoryMovement
from inventory.services import decrease_stock, increase_stock
from .conversions import convert_quantity


def effective_consumption(item):
    quantity = item.quantity * (Decimal('1.00') + item.waste_percentage / Decimal('100.00'))
    return convert_quantity(quantity, item.unit, item.ingredient.unit)


def calculate_product_recipe_cost(product):
    items = product.recipe_items.select_related('ingredient')
    total = Decimal('0.00')
    missing = []
    count = 0
    for item in items:
        count += 1
        ingredient = item.ingredient
        quantity = effective_consumption(item)
        if ingredient.purchase_price <= 0:
            missing.append(ingredient.name)
        total += quantity * ingredient.purchase_price
    return {
        'recipe_cost': total,
        'ingredients_count': count,
        'missing_costs': missing,
        'incomplete_recipe': count == 0 or bool(missing),
    }


def calculate_available_units(product):
    items = list(product.recipe_items.select_related('ingredient'))
    if not items:
        return {'available_units': None, 'limiting_ingredient': None, 'alerts': ['Producto sin receta']}
    limits = []
    alerts = []
    for item in items:
        needed = effective_consumption(item)
        if needed <= 0:
            continue
        units = (item.ingredient.current_stock / needed).to_integral_value(rounding=ROUND_FLOOR)
        limits.append((units, item.ingredient.name))
        if item.ingredient.current_stock <= 0:
            alerts.append(f'Sin stock de {item.ingredient.name}')
    if not limits:
        return {'available_units': 0, 'limiting_ingredient': None, 'alerts': alerts}
    units, ingredient = min(limits, key=lambda value: value[0])
    return {'available_units': int(units), 'limiting_ingredient': ingredient, 'alerts': alerts}


def consume_product_recipe(product, quantity, pedido, strict=True):
    items = list(product.recipe_items.select_related('ingredient'))
    if not items:
        return []
    ingredient_ids = [item.ingredient_id for item in items]
    locked = {ingredient.id: ingredient for ingredient in Ingredient.objects.select_for_update().filter(id__in=ingredient_ids)}
    warnings = []
    consumptions = []
    for item in items:
        ingredient = locked[item.ingredient_id]
        total_needed = effective_consumption(item) * Decimal(quantity)
        if ingredient.current_stock < total_needed:
            message = f'Stock insuficiente de {ingredient.name} para {product.name}.'
            if strict:
                raise serializers.ValidationError({'stock': message})
            warnings.append({'product_id': product.id, 'ingredient_id': ingredient.id, 'message': message})
            return warnings
        consumptions.append((ingredient, total_needed))
    for ingredient, total_needed in consumptions:
        decrease_stock(ingredient, total_needed, movement_type=InventoryMovement.TYPE_SALE_CONSUMPTION, notes=f'Consumo por Pedido #{pedido.id} - {product.name}', pedido=pedido, producto=product)
    return warnings


@transaction.atomic
def restore_order_inventory(pedido):
    if pedido.inventory_restored_at:
        return
    for movement in pedido.inventory_movements.filter(movement_type=InventoryMovement.TYPE_SALE_CONSUMPTION).select_related('ingredient', 'producto'):
        increase_stock(movement.ingredient, movement.quantity, movement_type=InventoryMovement.TYPE_RETURN, notes=f'Devolucion por cancelacion Pedido #{pedido.id}', pedido=pedido, producto=movement.producto)
