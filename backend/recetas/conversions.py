from decimal import Decimal

from rest_framework import serializers

WEIGHT = {'kg': Decimal('1000'), 'g': Decimal('1')}
VOLUME = {'l': Decimal('1000'), 'ml': Decimal('1')}


def validate_compatible_units(from_unit, to_unit):
    if from_unit == to_unit:
        return True
    if from_unit in WEIGHT and to_unit in WEIGHT:
        return True
    if from_unit in VOLUME and to_unit in VOLUME:
        return True
    raise serializers.ValidationError({'unit': 'La unidad no es compatible con el insumo.'})


def convert_quantity(quantity, from_unit, to_unit):
    quantity = Decimal(str(quantity))
    validate_compatible_units(from_unit, to_unit)
    if from_unit == to_unit:
        return quantity
    if from_unit in WEIGHT:
        return quantity * WEIGHT[from_unit] / WEIGHT[to_unit]
    if from_unit in VOLUME:
        return quantity * VOLUME[from_unit] / VOLUME[to_unit]
    return quantity
