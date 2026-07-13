from django.contrib import admin

from .models import Producto


@admin.register(Producto)
class ProductoAdmin(admin.ModelAdmin):
    list_display = ('name', 'negocio', 'categoria', 'price', 'available')
    list_filter = ('available', 'featured', 'negocio', 'categoria')
    search_fields = ('name', 'description')
    readonly_fields = ('created_at', 'updated_at')
