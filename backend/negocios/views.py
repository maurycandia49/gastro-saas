from rest_framework import permissions, viewsets

from .models import Negocio
from .serializers import NegocioSerializer


class NegocioViewSet(viewsets.ModelViewSet):
    serializer_class = NegocioSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Negocio.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)
