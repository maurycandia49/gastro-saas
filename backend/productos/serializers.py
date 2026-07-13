from rest_framework import serializers

from categorias.models import Categoria
from negocios.models import Negocio
from .models import Producto


class ProductoSerializer(serializers.ModelSerializer):
    negocio = serializers.PrimaryKeyRelatedField(queryset=Negocio.objects.all())
    categoria = serializers.PrimaryKeyRelatedField(queryset=Categoria.objects.all())

    class Meta:
        model = Producto
        fields = ['id', 'negocio', 'categoria', 'name', 'description', 'price', 'image', 'available', 'featured', 'order', 'created_at', 'updated_at']
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
