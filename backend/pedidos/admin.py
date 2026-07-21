from django.contrib import admin

from .models import DetallePedido, Pedido


class DetallePedidoInline(admin.TabularInline):
    model = DetallePedido
    extra = 0
    readonly_fields = ['producto', 'product_name', 'unit_price', 'quantity', 'subtotal']


@admin.register(Pedido)
class PedidoAdmin(admin.ModelAdmin):
    list_display = ['id', 'negocio', 'customer_name', 'status', 'total', 'created_at']
    list_filter = ['status', 'created_at']
    search_fields = ['customer_name', 'delivery_address']
    inlines = [DetallePedidoInline]
