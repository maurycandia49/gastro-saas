from django.db import models

from negocios.models import Negocio
from productos.models import Producto


class Pedido(models.Model):
    STATUS_PENDING = 'pendiente'
    STATUS_ACCEPTED = 'aceptado'
    STATUS_PREPARING = 'preparando'
    STATUS_READY = 'listo'
    STATUS_DELIVERED = 'entregado'
    STATUS_CANCELLED = 'cancelado'

    STATUS_CHOICES = [
        (STATUS_PENDING, 'Pendiente'),
        (STATUS_ACCEPTED, 'Aceptado'),
        (STATUS_PREPARING, 'Preparando'),
        (STATUS_READY, 'Listo'),
        (STATUS_DELIVERED, 'Entregado'),
        (STATUS_CANCELLED, 'Cancelado'),
    ]
    FULFILLMENT_DELIVERY = 'delivery'
    FULFILLMENT_PICKUP = 'pickup'
    FULFILLMENT_CHOICES = [
        (FULFILLMENT_DELIVERY, 'Delivery'),
        (FULFILLMENT_PICKUP, 'Pickup'),
    ]

    negocio = models.ForeignKey(Negocio, related_name='pedidos', on_delete=models.CASCADE)
    customer_name = models.CharField(max_length=255)
    customer_phone = models.CharField(max_length=50, blank=True)
    delivery_address = models.CharField(max_length=512)
    notes = models.TextField(blank=True)
    fulfillment_type = models.CharField(max_length=20, choices=FULFILLMENT_CHOICES, default=FULFILLMENT_DELIVERY)
    delivery_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    estimated_minutes = models.PositiveIntegerField(blank=True, null=True)
    inventory_warnings = models.JSONField(default=list, blank=True)
    inventory_restored_at = models.DateTimeField(blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING)
    total = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'Pedido #{self.pk}'


class DetallePedido(models.Model):
    pedido = models.ForeignKey(Pedido, related_name='items', on_delete=models.CASCADE)
    producto = models.ForeignKey(Producto, related_name='detalles_pedido', on_delete=models.PROTECT)
    product_name = models.CharField(max_length=255)
    original_unit_price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    unit_cost = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    promotion_name = models.CharField(max_length=255, blank=True)
    discount_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    quantity = models.PositiveIntegerField()
    subtotal = models.DecimalField(max_digits=12, decimal_places=2)
    subtotal_cost = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    profit = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    class Meta:
        ordering = ['id']

    def __str__(self):
        return f'{self.quantity} x {self.product_name}'
