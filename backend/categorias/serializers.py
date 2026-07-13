from rest_framework import serializers

from negocios.models import Negocio
from .models import Categoria


class CategoriaSerializer(serializers.ModelSerializer):
    negocio = serializers.PrimaryKeyRelatedField(queryset=Negocio.objects.all())

    class Meta:
        model = Categoria
        fields = ['id', 'negocio', 'name', 'description', 'order', 'active', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate_negocio(self, value):
        request = self.context.get('request')
        if request and not value.user_id == request.user.id:
            raise serializers.ValidationError('You can only use your own businesses.')
        return value
