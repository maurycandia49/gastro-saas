from django.contrib import admin

from .models import Categoria


@admin.register(Categoria)
class CategoriaAdmin(admin.ModelAdmin):
    list_display = ('name', 'negocio', 'order', 'active', 'created_at')
    list_filter = ('active', 'negocio')
    search_fields = ('name', 'description')
    readonly_fields = ('created_at', 'updated_at')
