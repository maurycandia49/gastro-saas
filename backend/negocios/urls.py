from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import NegocioViewSet, PublicMenuView

router = DefaultRouter()
router.register('negocios', NegocioViewSet, basename='negocio')

urlpatterns = [
    path('public/menu/<int:business_id>/', PublicMenuView.as_view(), name='public_menu'),
    path('', include(router.urls)),
]
