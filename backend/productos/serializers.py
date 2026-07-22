from rest_framework import serializers

from categorias.models import Categoria
from negocios.models import Negocio
from recetas.costing import create_snapshot_if_changed, recalculate_product_alerts
from recetas.models import ProductCostSnapshot
from .models import Producto


class ProductoSerializer(serializers.ModelSerializer):
    negocio = serializers.PrimaryKeyRelatedField(queryset=Negocio.objects.all())
    categoria = serializers.PrimaryKeyRelatedField(queryset=Categoria.objects.all())

    class Meta:
        model = Producto
        fields = ['id', 'negocio', 'categoria', 'name', 'description', 'price', 'cost_price', 'image', 'available', 'featured', 'order', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate_negocio(self, value):
        request = self.context.get('request')
        if request and value.user_id != request.user.id:
            raise serializers.ValidationError('You can only use your own businesses.')
        return value

    def validate_categoria(self, value):
        request = self.context.get('request')
        if request and value.negocio.user_id != request.user.id:
            raise serializers.ValidationError('You can only use categories from your own businesses.')
        return value

    def update(self, instance, validated_data):
        previous_price = instance.price
        product = super().update(instance, validated_data)
        if 'price' in validated_data and previous_price != product.price:
            create_snapshot_if_changed(product, ProductCostSnapshot.TRIGGER_PRODUCT_PRICE_CHANGE)
            recalculate_product_alerts(product)
        return product
