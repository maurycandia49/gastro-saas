from rest_framework import serializers

from .models import Negocio


class NegocioSerializer(serializers.ModelSerializer):
    class Meta:
        model = Negocio
        fields = [
            'id',
            'name',
            'phone',
            'email',
            'address',
            'logo',
            'active',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
