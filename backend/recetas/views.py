from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from productos.models import Producto
from .costing import create_snapshot_if_changed, recalculate_product_alerts
from .models import ProductCostSnapshot, RecipeIngredient
from .serializers import RecipeIngredientSerializer, build_recipe_response


class ProductRecipeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_product(self, request, product_id):
        try:
            return Producto.objects.get(pk=product_id, negocio__user=request.user)
        except Producto.DoesNotExist:
            return None

    def get(self, request, product_id):
        product = self.get_product(request, product_id)
        if not product:
            return Response({'detail': 'Producto no encontrado.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(build_recipe_response(product))

    def post(self, request, product_id):
        product = self.get_product(request, product_id)
        if not product:
            return Response({'detail': 'Producto no encontrado.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = RecipeIngredientSerializer(data=request.data, context={'product': product})
        serializer.is_valid(raise_exception=True)
        serializer.save(producto=product)
        create_snapshot_if_changed(product, ProductCostSnapshot.TRIGGER_RECIPE_CHANGE)
        recalculate_product_alerts(product)
        return Response(build_recipe_response(product), status=status.HTTP_201_CREATED)

    def put(self, request, product_id):
        product = self.get_product(request, product_id)
        if not product:
            return Response({'detail': 'Producto no encontrado.'}, status=status.HTTP_404_NOT_FOUND)
        product.recipe_items.all().delete()
        for item in request.data:
            serializer = RecipeIngredientSerializer(data=item, context={'product': product})
            serializer.is_valid(raise_exception=True)
            serializer.save(producto=product)
        create_snapshot_if_changed(product, ProductCostSnapshot.TRIGGER_RECIPE_CHANGE)
        recalculate_product_alerts(product)
        return Response(build_recipe_response(product))


class ProductRecipeItemDeleteView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, product_id, item_id):
        try:
            item = RecipeIngredient.objects.get(pk=item_id, producto_id=product_id, producto__negocio__user=request.user)
        except RecipeIngredient.DoesNotExist:
            return Response({'detail': 'Ingrediente no encontrado.'}, status=status.HTTP_404_NOT_FOUND)
        product = item.producto
        item.delete()
        create_snapshot_if_changed(product, ProductCostSnapshot.TRIGGER_RECIPE_CHANGE)
        recalculate_product_alerts(product)
        return Response(build_recipe_response(product))
