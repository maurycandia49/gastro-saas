from django.contrib import admin

from .models import Negocio


@admin.register(Negocio)
class NegocioAdmin(admin.ModelAdmin):
    list_display = ('name', 'user', 'email', 'phone', 'active', 'created_at')
    list_filter = ('active',)
    search_fields = ('name', 'email', 'address', 'phone')
    readonly_fields = ('created_at', 'updated_at')
