from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import BusinessSchedulesView, BusinessSettingsView, NegocioViewSet, PublicMenuView

router = DefaultRouter()
router.register('negocios', NegocioViewSet, basename='negocio')

urlpatterns = [
    path('public/menu/<int:business_id>/', PublicMenuView.as_view(), name='public_menu'),
    path('business-settings/', BusinessSettingsView.as_view(), name='business_settings'),
    path('business-schedules/', BusinessSchedulesView.as_view(), name='business_schedules'),
    path('', include(router.urls)),
]
