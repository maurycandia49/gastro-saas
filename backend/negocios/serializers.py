from rest_framework import serializers

from categorias.models import Categoria
from productos.models import Producto
from .models import Negocio


class NegocioSerializer(serializers.ModelSerializer):
    class Meta:
        model = Negocio
        fields = [
            'id',
            'name',
            'description',
            'phone',
            'email',
            'address',
            'logo',
            'cover_image',
            'primary_color',
            'opening_hours',
            'instagram',
            'facebook',
            'active',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class PublicProductoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Producto
        fields = ['id', 'categoria', 'name', 'description', 'price', 'image', 'available', 'order']


class PublicCategoriaSerializer(serializers.ModelSerializer):
    productos = PublicProductoSerializer(many=True, read_only=True)

    class Meta:
        model = Categoria
        fields = ['id', 'name', 'description', 'order', 'productos']


class PublicMenuSerializer(serializers.ModelSerializer):
    categorias = PublicCategoriaSerializer(many=True, read_only=True)

    class Meta:
        model = Negocio
        fields = [
            'id',
            'name',
            'description',
            'phone',
            'email',
            'address',
            'logo',
            'cover_image',
            'primary_color',
            'opening_hours',
            'instagram',
            'facebook',
            'categorias',
        ]
