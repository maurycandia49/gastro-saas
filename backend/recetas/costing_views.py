from rest_framework import permissions, serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from inventory.models import Ingredient
from negocios.models import Negocio
from productos.models import Producto
from .costing import (
    calculate_suggested_price,
    costing_summary,
    create_snapshot_if_changed,
    ingredient_cost_impact,
    product_cost_payload,
    recalculate_product_alerts,
)
from .models import ProductCostSnapshot, ProfitabilityAlert


def get_business(request):
    business_id = request.query_params.get('business_id')
    if not business_id:
        return None
    return Negocio.objects.filter(pk=business_id, user=request.user).first()


def products_queryset(user):
    return (
        Producto.objects
        .filter(negocio__user=user)
        .select_related('negocio', 'categoria')
        .prefetch_related('recipe_items__ingredient', 'cost_snapshots', 'profitability_alerts')
    )


class CostingProductsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        business = get_business(request)
        if not business:
            return Response({'detail': 'Negocio no encontrado.'}, status=status.HTTP_404_NOT_FOUND)
        products = products_queryset(request.user).filter(negocio=business)
        return Response([product_cost_payload(product) for product in products])


class CostingProductDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_product(self, request, product_id):
        return products_queryset(request.user).filter(pk=product_id).first()

    def get(self, request, product_id):
        product = self.get_product(request, product_id)
        if not product:
            return Response({'detail': 'Producto no encontrado.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(product_cost_payload(product))


class CostingProductRecalculateView(CostingProductDetailView):
    def post(self, request, product_id):
        product = self.get_product(request, product_id)
        if not product:
            return Response({'detail': 'Producto no encontrado.'}, status=status.HTTP_404_NOT_FOUND)
        snapshot, created = create_snapshot_if_changed(product, ProductCostSnapshot.TRIGGER_MANUAL)
        recalculate_product_alerts(product)
        payload = product_cost_payload(product)
        payload['snapshot_created'] = created
        payload['snapshot_id'] = snapshot.id
        return Response(payload)


class SuggestedPriceView(CostingProductDetailView):
    def get(self, request, product_id):
        product = self.get_product(request, product_id)
        if not product:
            return Response({'detail': 'Producto no encontrado.'}, status=status.HTTP_404_NOT_FOUND)
        target_margin = request.query_params.get('target_margin')
        if target_margin is None:
            return Response({'target_margin': 'Este parametro es requerido.'}, status=status.HTTP_400_BAD_REQUEST)
        return Response(calculate_suggested_price(product, target_margin))


class ApplySuggestedPriceView(CostingProductDetailView):
    def post(self, request, product_id):
        product = self.get_product(request, product_id)
        if not product:
            return Response({'detail': 'Producto no encontrado.'}, status=status.HTTP_404_NOT_FOUND)
        target_margin = request.data.get('target_margin')
        if target_margin is None:
            return Response({'target_margin': 'Este campo es requerido.'}, status=status.HTTP_400_BAD_REQUEST)
        suggestion = calculate_suggested_price(product, target_margin)
        product.price = suggestion['suggested_price']
        product.save(update_fields=['price', 'updated_at'])
        snapshot, created = create_snapshot_if_changed(product, ProductCostSnapshot.TRIGGER_PRODUCT_PRICE_CHANGE)
        recalculate_product_alerts(product)
        return Response({'product': product_cost_payload(product), 'suggestion': suggestion, 'snapshot_created': created, 'snapshot_id': snapshot.id})


class CostingSummaryView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        business = get_business(request)
        if not business:
            return Response({'detail': 'Negocio no encontrado.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(costing_summary(request.user, business.id))


class ProfitabilityAlertsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        business = get_business(request)
        if not business:
            return Response({'detail': 'Negocio no encontrado.'}, status=status.HTTP_404_NOT_FOUND)
        alerts = ProfitabilityAlert.objects.filter(negocio=business).select_related('producto').order_by('-created_at')
        return Response([
            {
                'id': alert.id,
                'product_id': alert.producto_id,
                'product_name': alert.producto.name,
                'alert_type': alert.alert_type,
                'title': alert.title,
                'message': alert.message,
                'severity': alert.severity,
                'previous_value': alert.previous_value,
                'current_value': alert.current_value,
                'read': alert.read,
                'resolved': alert.resolved,
                'created_at': alert.created_at,
                'resolved_at': alert.resolved_at,
            }
            for alert in alerts
        ])


class ProfitabilityAlertDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    class PatchSerializer(serializers.Serializer):
        read = serializers.BooleanField(required=False)
        resolved = serializers.BooleanField(required=False)

    def patch(self, request, alert_id):
        alert = ProfitabilityAlert.objects.filter(pk=alert_id, negocio__user=request.user).first()
        if not alert:
            return Response({'detail': 'Alerta no encontrada.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = self.PatchSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        for field, value in serializer.validated_data.items():
            setattr(alert, field, value)
        if serializer.validated_data.get('resolved'):
            from django.utils import timezone
            alert.resolved_at = timezone.now()
        alert.save()
        return Response({'id': alert.id, 'read': alert.read, 'resolved': alert.resolved, 'resolved_at': alert.resolved_at})


class IngredientCostImpactView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, ingredient_id):
        ingredient = Ingredient.objects.filter(pk=ingredient_id, negocio__user=request.user).first()
        if not ingredient:
            return Response({'detail': 'Ingrediente no encontrado.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(ingredient_cost_impact(ingredient))
