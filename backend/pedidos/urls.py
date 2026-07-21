from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .customer_views import CustomerDetailView, CustomerListView
from .metrics_views import HourlySalesView, MetricsSummaryView, ProfitMetricsView
from .views import PedidoViewSet, PublicPedidoCreateView

router = DefaultRouter()
router.register('orders', PedidoViewSet, basename='order')

urlpatterns = [
    path('public/orders/', PublicPedidoCreateView.as_view(), name='public_order_create'),
    path('metrics/summary/', MetricsSummaryView.as_view(), name='metrics_summary'),
    path('metrics/hourly-sales/', HourlySalesView.as_view(), name='metrics_hourly_sales'),
    path('metrics/profit/', ProfitMetricsView.as_view(), name='metrics_profit'),
    path('customers/', CustomerListView.as_view(), name='customer_list'),
    path('customers/<str:phone>/', CustomerDetailView.as_view(), name='customer_detail'),
    path('', include(router.urls)),
]
