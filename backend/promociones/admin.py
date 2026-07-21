from django.contrib import admin

from .models import Promocion


@admin.register(Promocion)
class PromocionAdmin(admin.ModelAdmin):
    list_display = ['id', 'name', 'negocio', 'promotion_type', 'active', 'featured', 'starts_at', 'ends_at']
    list_filter = ['promotion_type', 'active', 'featured']
