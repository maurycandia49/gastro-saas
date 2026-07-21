from decimal import Decimal

from django.db import transaction
from rest_framework import serializers

from negocios.models import Negocio
from productos.models import Producto
from .models import DetallePedido, Pedido


class PedidoItemCreateSerializer(serializers.Serializer):
    product_id = serializers.IntegerField()
    quantity = serializers.IntegerField(min_value=1)


class DetallePedidoSerializer(serializers.ModelSerializer):
    product_id = serializers.IntegerField(source='producto_id', read_only=True)

    class Meta:
        model = DetallePedido
        fields = ['id', 'product_id', 'product_name', 'unit_price', 'unit_cost', 'quantity', 'subtotal', 'subtotal_cost', 'profit']


class PublicPedidoCreateSerializer(serializers.Serializer):
    business_id = serializers.IntegerField()
    customer_name = serializers.CharField(max_length=255)
    customer_phone = serializers.CharField(max_length=50, required=False, allow_blank=True)
    delivery_address = serializers.CharField(max_length=512)
    notes = serializers.CharField(required=False, allow_blank=True)
    items = PedidoItemCreateSerializer(many=True)

    def validate_business_id(self, value):
        try:
            return Negocio.objects.get(pk=value, active=True)
        except Negocio.DoesNotExist as exc:
            raise serializers.ValidationError('El negocio no existe o no esta activo.') from exc

    def validate_items(self, value):
        if not value:
            raise serializers.ValidationError('El pedido debe incluir al menos un producto.')
        return value

    def validate(self, attrs):
        negocio = attrs['business_id']
        product_ids = [item['product_id'] for item in attrs['items']]
        products = Producto.objects.filter(id__in=product_ids).select_related('negocio')
        products_by_id = {product.id: product for product in products}

        for item in attrs['items']:
            product = products_by_id.get(item['product_id'])
            if product is None or product.negocio_id != negocio.id:
                raise serializers.ValidationError({'items': 'Todos los productos deben pertenecer al negocio.'})
            if not product.available:
                raise serializers.ValidationError({'items': f'{product.name} no esta disponible.'})

        attrs['negocio'] = negocio
        attrs['products_by_id'] = products_by_id
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        negocio = validated_data['negocio']
        products_by_id = validated_data['products_by_id']
        items = validated_data['items']

        pedido = Pedido.objects.create(
            negocio=negocio,
            customer_name=validated_data['customer_name'],
            customer_phone=validated_data.get('customer_phone', ''),
            delivery_address=validated_data['delivery_address'],
            notes=validated_data.get('notes', ''),
        )

        total = Decimal('0.00')
        details = []
        for item in items:
            product = products_by_id[item['product_id']]
            quantity = item['quantity']
            subtotal = product.price * quantity
            subtotal_cost = product.cost_price * quantity
            profit = subtotal - subtotal_cost
            total += subtotal
            details.append(
                DetallePedido(
                    pedido=pedido,
                    producto=product,
                    product_name=product.name,
                    unit_price=product.price,
                    unit_cost=product.cost_price,
                    quantity=quantity,
                    subtotal=subtotal,
                    subtotal_cost=subtotal_cost,
                    profit=profit,
                )
            )

        DetallePedido.objects.bulk_create(details)
        pedido.total = total
        pedido.save(update_fields=['total', 'updated_at'])
        return pedido

    def to_representation(self, instance):
        return PedidoSerializer(instance).data


class PedidoSerializer(serializers.ModelSerializer):
    items = DetallePedidoSerializer(many=True, read_only=True)
    items_count = serializers.SerializerMethodField()
    negocio_name = serializers.CharField(source='negocio.name', read_only=True)

    class Meta:
        model = Pedido
        fields = [
            'id',
            'negocio',
            'negocio_name',
            'customer_name',
            'customer_phone',
            'delivery_address',
            'notes',
            'status',
            'total',
            'items_count',
            'created_at',
            'updated_at',
            'items',
        ]
        read_only_fields = fields

    def get_items_count(self, obj):
        return sum(item.quantity for item in obj.items.all())


class PedidoStatusSerializer(serializers.ModelSerializer):
    class Meta:
        model = Pedido
        fields = ['status']
