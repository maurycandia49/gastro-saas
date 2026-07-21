from rest_framework import serializers

from negocios.models import Negocio
from .models import Ingredient, InventoryMovement


class IngredientSerializer(serializers.ModelSerializer):
    negocio = serializers.PrimaryKeyRelatedField(queryset=Negocio.objects.all())
    inventory_value = serializers.SerializerMethodField()
    low_stock = serializers.SerializerMethodField()

    class Meta:
        model = Ingredient
        fields = ['id', 'negocio', 'name', 'description', 'sku', 'category', 'unit', 'current_stock', 'minimum_stock', 'purchase_price', 'supplier', 'barcode', 'active', 'inventory_value', 'low_stock', 'created_at', 'updated_at']
        read_only_fields = ['id', 'inventory_value', 'low_stock', 'created_at', 'updated_at']

    def get_inventory_value(self, obj):
        return obj.current_stock * obj.purchase_price

    def get_low_stock(self, obj):
        return obj.current_stock <= obj.minimum_stock

    def validate_negocio(self, value):
        request = self.context.get('request')
        if request and value.user_id != request.user.id:
            raise serializers.ValidationError('Solo puedes usar tus negocios.')
        return value

    def validate(self, attrs):
        for field in ['current_stock', 'minimum_stock', 'purchase_price']:
            value = attrs.get(field)
            if value is not None and value < 0:
                raise serializers.ValidationError({field: 'No puede ser negativo.'})
        return attrs


class InventoryMovementSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)

    class Meta:
        model = InventoryMovement
        fields = ['id', 'ingredient', 'movement_type', 'quantity', 'previous_stock', 'new_stock', 'notes', 'pedido', 'producto', 'created_at', 'created_by_name']
        read_only_fields = fields


class StockMovementSerializer(serializers.Serializer):
    quantity = serializers.DecimalField(max_digits=12, decimal_places=3)
    notes = serializers.CharField(required=False, allow_blank=True)
