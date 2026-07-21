from decimal import Decimal

from django.db import transaction
from rest_framework import serializers

from negocios.models import Negocio
from negocios.operations import calculate_delivery_fee, ensure_business_settings, get_business_open_status
from productos.models import Producto
from promociones.pricing import get_effective_price
from recetas.services import consume_product_recipe
from .models import DetallePedido, Pedido


class PedidoItemCreateSerializer(serializers.Serializer):
    product_id = serializers.IntegerField()
    quantity = serializers.IntegerField(min_value=1)


class DetallePedidoSerializer(serializers.ModelSerializer):
    product_id = serializers.IntegerField(source='producto_id', read_only=True)

    class Meta:
        model = DetallePedido
        fields = ['id', 'product_id', 'product_name', 'original_unit_price', 'unit_price', 'unit_cost', 'promotion_name', 'discount_amount', 'quantity', 'subtotal', 'subtotal_cost', 'profit']


class PublicPedidoCreateSerializer(serializers.Serializer):
    business_id = serializers.IntegerField()
    customer_name = serializers.CharField(max_length=255)
    customer_phone = serializers.CharField(max_length=50, required=False, allow_blank=True)
    delivery_address = serializers.CharField(max_length=512, required=False, allow_blank=True)
    notes = serializers.CharField(required=False, allow_blank=True)
    fulfillment_type = serializers.ChoiceField(choices=[Pedido.FULFILLMENT_DELIVERY, Pedido.FULFILLMENT_PICKUP], default=Pedido.FULFILLMENT_DELIVERY)
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
        settings = ensure_business_settings(negocio)
        status_info = get_business_open_status(negocio)
        fulfillment_type = validated_data.get('fulfillment_type', Pedido.FULFILLMENT_DELIVERY)
        if not status_info['accepts_orders']:
            raise serializers.ValidationError('El negocio no esta aceptando pedidos en este momento.')
        if fulfillment_type == Pedido.FULFILLMENT_DELIVERY and not settings.delivery_enabled:
            raise serializers.ValidationError('El delivery no esta disponible.')
        if fulfillment_type == Pedido.FULFILLMENT_PICKUP and not settings.pickup_enabled:
            raise serializers.ValidationError('El retiro no esta disponible.')
        if settings.require_customer_phone and not validated_data.get('customer_phone', '').strip():
            raise serializers.ValidationError({'customer_phone': 'El telefono es obligatorio.'})
        if fulfillment_type == Pedido.FULFILLMENT_DELIVERY and settings.require_delivery_address and not validated_data.get('delivery_address', '').strip():
            raise serializers.ValidationError({'delivery_address': 'La direccion es obligatoria.'})

        products_by_id = validated_data['products_by_id']
        items = validated_data['items']

        pedido = Pedido.objects.create(
            negocio=negocio,
            customer_name=validated_data['customer_name'],
            customer_phone=validated_data.get('customer_phone', ''),
            delivery_address=validated_data.get('delivery_address', ''),
            notes=validated_data.get('notes', ''),
            fulfillment_type=fulfillment_type,
            estimated_minutes=settings.estimated_delivery_minutes if fulfillment_type == Pedido.FULFILLMENT_DELIVERY else settings.estimated_pickup_minutes,
        )

        total = Decimal('0.00')
        details = []
        warnings = []
        for item in items:
            product = products_by_id[item['product_id']]
            quantity = item['quantity']
            price_info = get_effective_price(product)
            unit_price = price_info['final_price']
            subtotal = unit_price * quantity
            subtotal_cost = product.cost_price * quantity
            profit = subtotal - subtotal_cost
            total += subtotal
            details.append(
                DetallePedido(
                    pedido=pedido,
                    producto=product,
                    product_name=product.name,
                    original_unit_price=price_info['original_price'],
                    unit_price=unit_price,
                    unit_cost=product.cost_price,
                    promotion_name=price_info['promotion_name'],
                    discount_amount=price_info['discount_amount'],
                    quantity=quantity,
                    subtotal=subtotal,
                    subtotal_cost=subtotal_cost,
                    profit=profit,
                )
            )

        if total < settings.minimum_order:
            raise serializers.ValidationError({'items': f'El pedido minimo es {settings.minimum_order}.'})
        delivery_fee = calculate_delivery_fee(settings, total, fulfillment_type)
        total += delivery_fee
        DetallePedido.objects.bulk_create(details)
        for item in items:
            product = products_by_id[item['product_id']]
            warnings.extend(consume_product_recipe(product, item['quantity'], pedido, strict=settings.prevent_sales_without_stock))
        pedido.total = total
        pedido.delivery_fee = delivery_fee
        pedido.inventory_warnings = warnings
        pedido.save(update_fields=['total', 'delivery_fee', 'inventory_warnings', 'updated_at'])
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
            'fulfillment_type',
            'delivery_fee',
            'estimated_minutes',
            'inventory_warnings',
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
