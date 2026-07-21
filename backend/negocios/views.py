from rest_framework import generics, permissions, status, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView
from django.core.exceptions import ValidationError
from django.db.models import Prefetch

from categorias.models import Categoria
from productos.models import Producto
from .models import Negocio
from .operations import ensure_business_settings
from .serializers import BusinessScheduleSerializer, ConfiguracionNegocioSerializer, NegocioSerializer, PublicMenuSerializer


class NegocioViewSet(viewsets.ModelViewSet):
    serializer_class = NegocioSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Negocio.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        negocio = serializer.save(user=self.request.user)
        ensure_business_settings(negocio)


class BusinessSettingsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_business(self, request):
        business_id = request.query_params.get('business_id')
        try:
            return Negocio.objects.get(pk=business_id, user=request.user)
        except Negocio.DoesNotExist:
            return None

    def get(self, request):
        business = self.get_business(request)
        if not business:
            return Response({'detail': 'Negocio no encontrado.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(ConfiguracionNegocioSerializer(ensure_business_settings(business)).data)

    def patch(self, request):
        business = self.get_business(request)
        if not business:
            return Response({'detail': 'Negocio no encontrado.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = ConfiguracionNegocioSerializer(ensure_business_settings(business), data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class BusinessSchedulesView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_business(self, request):
        business_id = request.query_params.get('business_id')
        try:
            return Negocio.objects.get(pk=business_id, user=request.user)
        except Negocio.DoesNotExist:
            return None

    def get(self, request):
        business = self.get_business(request)
        if not business:
            return Response({'detail': 'Negocio no encontrado.'}, status=status.HTTP_404_NOT_FOUND)
        ensure_business_settings(business)
        return Response(BusinessScheduleSerializer(business.schedules.all(), many=True).data)

    def put(self, request):
        business = self.get_business(request)
        if not business:
            return Response({'detail': 'Negocio no encontrado.'}, status=status.HTTP_404_NOT_FOUND)
        ensure_business_settings(business)
        serializers = [BusinessScheduleSerializer(data=item) for item in request.data]
        for serializer in serializers:
            serializer.is_valid(raise_exception=True)
        seen = set()
        for serializer in serializers:
            weekday = serializer.validated_data['weekday']
            if weekday in seen:
                return Response({'detail': 'No se permiten dias duplicados.'}, status=status.HTTP_400_BAD_REQUEST)
            seen.add(weekday)
        for serializer in serializers:
            try:
                business.schedules.update_or_create(weekday=serializer.validated_data['weekday'], defaults=serializer.validated_data)
            except ValidationError as exc:
                return Response(exc.message_dict if hasattr(exc, 'message_dict') else {'detail': exc.messages}, status=status.HTTP_400_BAD_REQUEST)
        return Response(BusinessScheduleSerializer(business.schedules.all(), many=True).data)


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
