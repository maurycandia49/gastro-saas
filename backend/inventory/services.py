from decimal import Decimal

from django.db import transaction
from rest_framework import serializers

from .models import Ingredient, InventoryMovement


def _validate_quantity(quantity):
    value = Decimal(str(quantity))
    if value <= 0:
        raise serializers.ValidationError({'quantity': 'La cantidad debe ser mayor que cero.'})
    return value


@transaction.atomic
def increase_stock(ingredient, quantity, movement_type=InventoryMovement.TYPE_PURCHASE, notes='', user=None, pedido=None, producto=None):
    quantity = _validate_quantity(quantity)
    ingredient = Ingredient.objects.select_for_update().get(pk=ingredient.pk)
    previous = ingredient.current_stock
    ingredient.current_stock = previous + quantity
    ingredient.save(update_fields=['current_stock', 'updated_at'])
    return InventoryMovement.objects.create(ingredient=ingredient, movement_type=movement_type, quantity=quantity, previous_stock=previous, new_stock=ingredient.current_stock, notes=notes, created_by=user, pedido=pedido, producto=producto)


@transaction.atomic
def decrease_stock(ingredient, quantity, movement_type=InventoryMovement.TYPE_MANUAL_ADJUSTMENT, notes='', user=None, pedido=None, producto=None):
    quantity = _validate_quantity(quantity)
    ingredient = Ingredient.objects.select_for_update().get(pk=ingredient.pk)
    previous = ingredient.current_stock
    new_stock = previous - quantity
    if new_stock < 0:
        raise serializers.ValidationError({'quantity': 'No se permite stock negativo.'})
    ingredient.current_stock = new_stock
    ingredient.save(update_fields=['current_stock', 'updated_at'])
    return InventoryMovement.objects.create(ingredient=ingredient, movement_type=movement_type, quantity=quantity, previous_stock=previous, new_stock=new_stock, notes=notes, created_by=user, pedido=pedido, producto=producto)


@transaction.atomic
def adjust_stock(ingredient, new_stock, notes='', user=None, pedido=None, producto=None):
    new_stock = Decimal(str(new_stock))
    if new_stock < 0:
        raise serializers.ValidationError({'quantity': 'No se permite stock negativo.'})
    ingredient = Ingredient.objects.select_for_update().get(pk=ingredient.pk)
    previous = ingredient.current_stock
    quantity = abs(new_stock - previous)
    ingredient.current_stock = new_stock
    ingredient.save(update_fields=['current_stock', 'updated_at'])
    return InventoryMovement.objects.create(ingredient=ingredient, movement_type=InventoryMovement.TYPE_MANUAL_ADJUSTMENT, quantity=quantity, previous_stock=previous, new_stock=new_stock, notes=notes, created_by=user, pedido=pedido, producto=producto)
