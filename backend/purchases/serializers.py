from decimal import Decimal
import json

from django.db import transaction
from rest_framework import serializers

from inventory.models import Ingredient
from negocios.models import Negocio
from .models import Purchase, PurchaseItem, Supplier
from .services import calculate_item_values, recalculate_purchase_totals


class SupplierSerializer(serializers.ModelSerializer):
    class Meta:
        model = Supplier
        fields = ['id', 'negocio', 'name', 'tax_id', 'contact_name', 'phone', 'email', 'address', 'notes', 'active', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate_negocio(self, value):
        request = self.context.get('request')
        if request and value.user_id != request.user.id:
            raise serializers.ValidationError('Solo puedes usar tus negocios.')
        return value


class PurchaseItemSerializer(serializers.ModelSerializer):
    description_snapshot = serializers.CharField(required=False, allow_blank=True)
    ingredient_name = serializers.CharField(source='ingredient.name', read_only=True)
    ingredient_unit = serializers.CharField(source='ingredient.unit', read_only=True)

    class Meta:
        model = PurchaseItem
        fields = ['id', 'ingredient', 'ingredient_name', 'ingredient_unit', 'description_snapshot', 'package_quantity', 'package_type', 'content_per_package', 'content_unit', 'total_content_in_stock_unit', 'total_price', 'unit_cost_in_stock_unit', 'quantity', 'unit', 'quantity_in_stock_unit', 'unit_price', 'subtotal', 'previous_purchase_price', 'new_purchase_price', 'created_at']
        read_only_fields = ['id', 'ingredient_name', 'ingredient_unit', 'quantity_in_stock_unit', 'total_content_in_stock_unit', 'subtotal', 'unit_cost_in_stock_unit', 'previous_purchase_price', 'new_purchase_price', 'created_at']
        extra_kwargs = {
            'quantity': {'required': False},
            'unit': {'required': False},
            'unit_price': {'required': False},
            'package_quantity': {'required': False, 'allow_null': True},
            'content_per_package': {'required': False, 'allow_null': True},
            'content_unit': {'required': False, 'allow_blank': True},
            'total_price': {'required': False},
        }

    def validate(self, attrs):
        ingredient = attrs.get('ingredient') or getattr(self.instance, 'ingredient', None)
        purchase = self.context.get('purchase')
        if purchase and ingredient and ingredient.negocio_id != purchase.negocio_id:
            raise serializers.ValidationError({'ingredient': 'El insumo debe pertenecer al negocio de la compra.'})
        if attrs.get('quantity') is not None and attrs['quantity'] <= 0:
            raise serializers.ValidationError({'quantity': 'La cantidad debe ser mayor que cero.'})
        if attrs.get('unit_price') is not None and attrs['unit_price'] < 0:
            raise serializers.ValidationError({'unit_price': 'El precio unitario no puede ser negativo.'})
        if attrs.get('package_quantity') is not None and attrs['package_quantity'] <= 0:
            raise serializers.ValidationError({'package_quantity': 'La cantidad de envases debe ser mayor que cero.'})
        if attrs.get('content_per_package') is not None and attrs['content_per_package'] <= 0:
            raise serializers.ValidationError({'content_per_package': 'El contenido por envase debe ser mayor que cero.'})
        if attrs.get('total_price') is not None and attrs['total_price'] < 0:
            raise serializers.ValidationError({'total_price': 'El precio total de la linea no puede ser negativo.'})
        return attrs


class PurchaseSerializer(serializers.ModelSerializer):
    items = PurchaseItemSerializer(many=True, required=False)
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)

    class Meta:
        model = Purchase
        fields = ['id', 'negocio', 'supplier', 'supplier_name', 'status', 'document_type', 'document_number', 'purchase_date', 'notes', 'document_image', 'subtotal', 'taxes', 'discounts', 'total', 'confirmed_at', 'confirmed_by', 'created_at', 'updated_at', 'items']
        read_only_fields = ['id', 'status', 'subtotal', 'total', 'confirmed_at', 'confirmed_by', 'created_at', 'updated_at']

    def validate_negocio(self, value):
        request = self.context.get('request')
        if request and value.user_id != request.user.id:
            raise serializers.ValidationError('Solo puedes usar tus negocios.')
        return value

    def to_internal_value(self, data):
        mutable = data.copy()
        items = mutable.get('items')
        if isinstance(items, str):
            try:
                mutable['items'] = json.loads(items)
            except json.JSONDecodeError:
                raise serializers.ValidationError({'items': 'Las lineas de compra no tienen un formato valido.'})
        return super().to_internal_value(mutable)

    def validate(self, attrs):
        supplier = attrs.get('supplier')
        negocio = attrs.get('negocio') or getattr(self.instance, 'negocio', None)
        if supplier and negocio and supplier.negocio_id != negocio.id:
            raise serializers.ValidationError({'supplier': 'El proveedor debe pertenecer al negocio.'})
        for field in ['taxes', 'discounts']:
            value = attrs.get(field)
            if value is not None and value < 0:
                raise serializers.ValidationError({field: 'No puede ser negativo.'})
        image = attrs.get('document_image')
        if image:
            if image.size > 5 * 1024 * 1024:
                raise serializers.ValidationError({'document_image': 'La imagen no puede superar 5 MB.'})
            content_type = getattr(image, 'content_type', '')
            if content_type and not content_type.startswith('image/'):
                raise serializers.ValidationError({'document_image': 'Adjunta una imagen valida.'})
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        items_data = validated_data.pop('items', [])
        purchase = Purchase.objects.create(**validated_data)
        self._save_items(purchase, items_data)
        recalculate_purchase_totals(purchase)
        return purchase

    @transaction.atomic
    def update(self, instance, validated_data):
        if instance.status != Purchase.STATUS_DRAFT:
            protected = {'supplier', 'negocio', 'purchase_date', 'taxes', 'discounts', 'document_type', 'document_number', 'items'}
            if protected.intersection(validated_data.keys()):
                raise serializers.ValidationError('No se pueden editar datos criticos de una compra confirmada.')
        items_data = validated_data.pop('items', None)
        for key, value in validated_data.items():
            setattr(instance, key, value)
        instance.save()
        if items_data is not None:
            instance.items.all().delete()
            self._save_items(instance, items_data)
        recalculate_purchase_totals(instance)
        return instance

    def _save_items(self, purchase, items_data):
        for item_data in items_data:
            ingredient = item_data['ingredient']
            if ingredient.negocio_id != purchase.negocio_id:
                raise serializers.ValidationError({
                    'items': 'Todos los insumos deben pertenecer al negocio de la compra.'
                })
            item = PurchaseItem(
                purchase=purchase,
                ingredient=ingredient,
                description_snapshot=item_data.get('description_snapshot') or ingredient.name,
                package_quantity=item_data.get('package_quantity'),
                package_type=item_data.get('package_type') or PurchaseItem.PACKAGE_UNIT,
                content_per_package=item_data.get('content_per_package'),
                content_unit=item_data.get('content_unit') or '',
                total_price=item_data.get('total_price') or Decimal('0.00'),
                quantity=item_data.get('quantity') or Decimal('0.000'),
                unit=item_data.get('unit') or item_data.get('content_unit') or ingredient.unit,
                unit_price=item_data.get('unit_price') or Decimal('0.00'),
            )
            quantity_in_stock_unit, subtotal, new_purchase_price = calculate_item_values(item)
            item.quantity_in_stock_unit = quantity_in_stock_unit
            item.total_content_in_stock_unit = quantity_in_stock_unit
            item.subtotal = subtotal
            item.previous_purchase_price = ingredient.purchase_price
            item.new_purchase_price = new_purchase_price
            item.unit_cost_in_stock_unit = new_purchase_price
            item.save()
