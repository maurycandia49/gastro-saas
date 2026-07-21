from rest_framework import permissions, viewsets

from .models import Promocion
from .serializers import PromocionSerializer


class PromocionViewSet(viewsets.ModelViewSet):
    serializer_class = PromocionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = Promocion.objects.filter(negocio__user=self.request.user).select_related('negocio', 'producto', 'categoria')
        business_id = self.request.query_params.get('business_id')
        active = self.request.query_params.get('active')
        featured = self.request.query_params.get('featured')
        promotion_type = self.request.query_params.get('promotion_type')

        if business_id:
            queryset = queryset.filter(negocio_id=business_id)
        if active in {'true', 'false'}:
            queryset = queryset.filter(active=active == 'true')
        if featured in {'true', 'false'}:
            queryset = queryset.filter(featured=featured == 'true')
        if promotion_type:
            queryset = queryset.filter(promotion_type=promotion_type)
        return queryset.order_by('-created_at')
