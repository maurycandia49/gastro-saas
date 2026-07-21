from rest_framework import serializers

from inventory.models import Ingredient
from productos.models import Producto
from .models import RecipeIngredient
from .services import calculate_available_units, calculate_product_recipe_cost, effective_consumption


class RecipeIngredientSerializer(serializers.ModelSerializer):
    ingredient_name = serializers.CharField(source='ingredient.name', read_only=True)
    ingredient_unit = serializers.CharField(source='ingredient.unit', read_only=True)
    item_cost = serializers.SerializerMethodField()

    class Meta:
        model = RecipeIngredient
        fields = ['id', 'producto', 'ingredient', 'ingredient_name', 'ingredient_unit', 'quantity', 'unit', 'waste_percentage', 'notes', 'item_cost', 'created_at', 'updated_at']
        read_only_fields = ['id', 'producto', 'ingredient_name', 'ingredient_unit', 'item_cost', 'created_at', 'updated_at']

    def get_item_cost(self, obj):
        return effective_consumption(obj) * obj.ingredient.purchase_price

    def validate_ingredient(self, value):
        product = self.context['product']
        if value.negocio_id != product.negocio_id:
            raise serializers.ValidationError('El ingrediente debe pertenecer al mismo negocio.')
        return value

    def validate(self, attrs):
        product = self.context['product']
        ingredient = attrs.get('ingredient')
        if ingredient and RecipeIngredient.objects.filter(producto=product, ingredient=ingredient).exists():
            raise serializers.ValidationError({'ingredient': 'Este ingrediente ya esta en la receta.'})
        return attrs


class RecipeSerializer(serializers.Serializer):
    items = RecipeIngredientSerializer(many=True)
    recipe_cost = serializers.DecimalField(max_digits=12, decimal_places=2)
    ingredients_count = serializers.IntegerField()
    missing_costs = serializers.ListField()
    incomplete_recipe = serializers.BooleanField()
    available_units = serializers.IntegerField(allow_null=True)
    limiting_ingredient = serializers.CharField(allow_null=True)
    alerts = serializers.ListField()


def build_recipe_response(product):
    cost = calculate_product_recipe_cost(product)
    availability = calculate_available_units(product)
    return {
        'items': RecipeIngredientSerializer(product.recipe_items.select_related('ingredient'), many=True).data,
        **cost,
        **availability,
    }
