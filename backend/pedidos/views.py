from rest_framework import generics, permissions, status, viewsets
from rest_framework.response import Response

from .models import Pedido
from .serializers import PedidoSerializer, PedidoStatusSerializer, PublicPedidoCreateSerializer
from recetas.services import restore_order_inventory
from django.utils import timezone


class PublicPedidoCreateView(generics.CreateAPIView):
    serializer_class = PublicPedidoCreateSerializer
    permission_classes = [permissions.AllowAny]


class PedidoViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = PedidoSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = Pedido.objects.filter(negocio__user=self.request.user).select_related('negocio').prefetch_related('items')
        negocio = self.request.query_params.get('negocio')
        status_filter = self.request.query_params.get('status')
        fecha = self.request.query_params.get('fecha')

        if negocio:
            queryset = queryset.filter(negocio_id=negocio)
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        if fecha:
            queryset = queryset.filter(created_at__date=fecha)

        return queryset

    def partial_update(self, request, *args, **kwargs):
        if set(request.data.keys()) != {'status'}:
            return Response({'detail': 'Solo se puede actualizar el estado del pedido.'}, status=status.HTTP_400_BAD_REQUEST)

        pedido = self.get_object()
        if pedido.status == Pedido.STATUS_CANCELLED and request.data.get('status') != Pedido.STATUS_CANCELLED:
            return Response({'detail': 'Un pedido cancelado es terminal.'}, status=status.HTTP_400_BAD_REQUEST)
        old_status = pedido.status
        serializer = PedidoStatusSerializer(pedido, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        if old_status != Pedido.STATUS_CANCELLED and pedido.status == Pedido.STATUS_CANCELLED:
            restore_order_inventory(pedido)
            pedido.inventory_restored_at = timezone.now()
            pedido.save(update_fields=['inventory_restored_at', 'updated_at'])
        return Response(self.get_serializer(pedido).data)
