from rest_framework import permissions, viewsets

from .models import Categoria
from .serializers import CategoriaSerializer


class CategoriaViewSet(viewsets.ModelViewSet):
    serializer_class = CategoriaSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Categoria.objects.filter(negocio__user=self.request.user)

    def perform_create(self, serializer):
        serializer.save()
