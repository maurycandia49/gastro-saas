from rest_framework import serializers

from categorias.models import Categoria
from negocios.models import Negocio
from productos.models import Producto
from .models import Promocion


class PromocionSerializer(serializers.ModelSerializer):
    negocio = serializers.PrimaryKeyRelatedField(queryset=Negocio.objects.all())
    producto = serializers.PrimaryKeyRelatedField(queryset=Producto.objects.all(), required=False, allow_null=True)
    categoria = serializers.PrimaryKeyRelatedField(queryset=Categoria.objects.all(), required=False, allow_null=True)
    target_name = serializers.SerializerMethodField()

    class Meta:
        model = Promocion
        fields = [
            'id', 'negocio', 'name', 'description', 'promotion_type',
            'percentage_discount', 'fixed_price', 'producto', 'categoria',
            'target_name', 'starts_at', 'ends_at', 'active', 'featured',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'target_name', 'created_at', 'updated_at']

    def get_target_name(self, obj):
        if obj.producto:
            return obj.producto.name
        if obj.categoria:
            return obj.categoria.name
        return ''

    def validate_negocio(self, value):
        request = self.context.get('request')
        if request and value.user_id != request.user.id:
            raise serializers.ValidationError('Solo puedes usar tus propios negocios.')
        return value

    def validate(self, attrs):
        instance = self.instance
        negocio = attrs.get('negocio', getattr(instance, 'negocio', None))
        producto = attrs.get('producto', getattr(instance, 'producto', None))
        categoria = attrs.get('categoria', getattr(instance, 'categoria', None))
        promotion_type = attrs.get('promotion_type', getattr(instance, 'promotion_type', None))
        percentage_discount = attrs.get('percentage_discount', getattr(instance, 'percentage_discount', None))
        fixed_price = attrs.get('fixed_price', getattr(instance, 'fixed_price', None))
        starts_at = attrs.get('starts_at', getattr(instance, 'starts_at', None))
        ends_at = attrs.get('ends_at', getattr(instance, 'ends_at', None))

        if bool(producto) == bool(categoria):
            raise serializers.ValidationError('Debes seleccionar un producto o una categoria, pero no ambos.')
        if producto and negocio and producto.negocio_id != negocio.id:
            raise serializers.ValidationError({'producto': 'El producto debe pertenecer al negocio.'})
        if categoria and negocio and categoria.negocio_id != negocio.id:
            raise serializers.ValidationError({'categoria': 'La categoria debe pertenecer al negocio.'})
        if promotion_type == Promocion.TYPE_PERCENTAGE:
            if percentage_discount is None:
                raise serializers.ValidationError({'percentage_discount': 'El porcentaje es obligatorio.'})
            if percentage_discount <= 0 or percentage_discount > 100:
                raise serializers.ValidationError({'percentage_discount': 'El porcentaje debe ser mayor que 0 y menor o igual a 100.'})
            attrs['fixed_price'] = None
        if promotion_type == Promocion.TYPE_FIXED_PRICE:
            if fixed_price is None:
                raise serializers.ValidationError({'fixed_price': 'El precio promocional es obligatorio.'})
            if fixed_price < 0:
                raise serializers.ValidationError({'fixed_price': 'El precio fijo debe ser mayor o igual a 0.'})
            attrs['percentage_discount'] = None
        if starts_at and ends_at and starts_at >= ends_at:
            raise serializers.ValidationError({'ends_at': 'La fecha de fin debe ser posterior al inicio.'})
        return attrs
