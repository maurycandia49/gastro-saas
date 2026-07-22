from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import BusinessSchedulesView, BusinessSettingsView, NegocioViewSet, PublicMenuView
from .search_views import GlobalSearchView

router = DefaultRouter()
router.register('negocios', NegocioViewSet, basename='negocio')

urlpatterns = [
    path('public/menu/<int:business_id>/', PublicMenuView.as_view(), name='public_menu'),
    path('business-settings/', BusinessSettingsView.as_view(), name='business_settings'),
    path('business-schedules/', BusinessSchedulesView.as_view(), name='business_schedules'),
    path('search/', GlobalSearchView.as_view(), name='global_search'),
    path('', include(router.urls)),
]
