from django.db.models import DecimalField, ExpressionWrapper, F, Sum
from django.db.models.functions import Coalesce
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Ingredient, InventoryMovement
from .serializers import IngredientSerializer, InventoryMovementSerializer, StockMovementSerializer
from .services import adjust_stock, decrease_stock, increase_stock
from recetas.costing import ingredient_cost_impact, recalculate_products_using_ingredient


class IngredientViewSet(viewsets.ModelViewSet):
    serializer_class = IngredientSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = Ingredient.objects.filter(negocio__user=self.request.user)
        business = self.request.query_params.get('business')
        category = self.request.query_params.get('category')
        supplier = self.request.query_params.get('supplier')
        active = self.request.query_params.get('active')
        low_stock = self.request.query_params.get('low_stock')
        ordering = self.request.query_params.get('ordering', 'name')
        if business:
            queryset = queryset.filter(negocio_id=business)
        if category:
            queryset = queryset.filter(category=category)
        if supplier:
            queryset = queryset.filter(supplier__icontains=supplier)
        if active in {'true', 'false'}:
            queryset = queryset.filter(active=active == 'true')
        if low_stock == 'true':
            queryset = queryset.filter(current_stock__lte=F('minimum_stock'))
        if ordering in {'name', '-name', 'current_stock', '-current_stock', 'updated_at', '-updated_at'}:
            queryset = queryset.order_by(ordering)
        return queryset

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        previous_price = instance.purchase_price
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        ingredient = serializer.save()
        data = serializer.data
        if 'purchase_price' in serializer.validated_data and previous_price != ingredient.purchase_price:
            data = {
                'ingredient': data,
                'previous_price': previous_price,
                'new_price': ingredient.purchase_price,
                'affected_products': recalculate_products_using_ingredient(ingredient),
            }
            data['affected_products_count'] = len(data['affected_products'])
            data['alerts_created'] = sum(item.get('alerts_created', 0) for item in data['affected_products'])
        return Response(data)

    @action(detail=False, methods=['get'])
    def summary(self, request):
        queryset = self.get_queryset()
        inventory_value = ExpressionWrapper(F('current_stock') * F('purchase_price'), output_field=DecimalField(max_digits=14, decimal_places=2))
        today = timezone.localdate()
        return Response({
            'total_ingredients': queryset.count(),
            'inventory_value': queryset.aggregate(total=Coalesce(Sum(inventory_value), 0, output_field=DecimalField(max_digits=14, decimal_places=2)))['total'],
            'low_stock': queryset.filter(current_stock__lte=F('minimum_stock')).count(),
            'movements_today': InventoryMovement.objects.filter(ingredient__in=queryset, created_at__date=today).count(),
        })

    def _movement(self, request, handler):
        ingredient = self.get_object()
        serializer = StockMovementSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        movement = handler(ingredient, serializer.validated_data['quantity'], notes=serializer.validated_data.get('notes', ''), user=request.user)
        return Response(InventoryMovementSerializer(movement).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def increase(self, request, pk=None):
        return self._movement(request, increase_stock)

    @action(detail=True, methods=['post'])
    def decrease(self, request, pk=None):
        return self._movement(request, decrease_stock)

    @action(detail=True, methods=['post'])
    def adjust(self, request, pk=None):
        ingredient = self.get_object()
        serializer = StockMovementSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        movement = adjust_stock(ingredient, serializer.validated_data['quantity'], notes=serializer.validated_data.get('notes', ''), user=request.user)
        return Response(InventoryMovementSerializer(movement).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'])
    def movements(self, request, pk=None):
        ingredient = self.get_object()
        return Response(InventoryMovementSerializer(ingredient.movements.select_related('created_by'), many=True).data)

    @action(detail=True, methods=['get'], url_path='cost-impact')
    def cost_impact(self, request, pk=None):
        ingredient = self.get_object()
        return Response(ingredient_cost_impact(ingredient))
