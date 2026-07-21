from datetime import datetime

from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from negocios.models import Negocio
from .metrics import get_hourly_sales, get_profit_metrics, get_summary_metrics


class MetricsBusinessMixin:
    def get_business(self, request):
        business_id = request.query_params.get('business_id')
        if not business_id:
            return None, Response({'detail': 'business_id es obligatorio.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            business = Negocio.objects.get(pk=business_id, user=request.user)
        except Negocio.DoesNotExist:
            return None, Response({'detail': 'Negocio no encontrado.'}, status=status.HTTP_404_NOT_FOUND)

        return business, None


class MetricsSummaryView(MetricsBusinessMixin, APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        business, error = self.get_business(request)
        if error:
            return error

        data = get_summary_metrics(
            user=request.user,
            business_id=business.id,
            period=request.query_params.get('period', 'today'),
        )
        return Response(data)


class HourlySalesView(MetricsBusinessMixin, APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        business, error = self.get_business(request)
        if error:
            return error

        date_value = request.query_params.get('date')
        if date_value:
            try:
                day = datetime.strptime(date_value, '%Y-%m-%d').date()
            except ValueError:
                return Response({'detail': 'date debe tener formato YYYY-MM-DD.'}, status=status.HTTP_400_BAD_REQUEST)
        else:
            day = datetime.now().date()

        return Response(get_hourly_sales(request.user, business.id, day))


class ProfitMetricsView(MetricsBusinessMixin, APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        business, error = self.get_business(request)
        if error:
            return error

        return Response(get_profit_metrics(
            user=request.user,
            business_id=business.id,
            period=request.query_params.get('period', 'today'),
        ))
