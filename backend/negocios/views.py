from rest_framework import generics, permissions, viewsets
from django.db.models import Prefetch

from categorias.models import Categoria
from productos.models import Producto
from .models import Negocio
from .serializers import NegocioSerializer, PublicMenuSerializer


class NegocioViewSet(viewsets.ModelViewSet):
    serializer_class = NegocioSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Negocio.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class PublicMenuView(generics.RetrieveAPIView):
    serializer_class = PublicMenuSerializer
    permission_classes = [permissions.AllowAny]
    lookup_url_kwarg = 'business_id'

    def get_queryset(self):
        public_products = Producto.objects.order_by('order', 'name')
        active_categories = Categoria.objects.filter(active=True).prefetch_related(
            Prefetch('productos', queryset=public_products),
        ).order_by('order', 'name')

        return Negocio.objects.filter(active=True).prefetch_related(
            Prefetch('categorias', queryset=active_categories),
        )
