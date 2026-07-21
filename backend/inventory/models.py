from django.conf import settings
from django.db import models

from negocios.models import Negocio


class Ingredient(models.Model):
    CATEGORY_CHOICES = [
        ('lacteos', 'Lacteos'),
        ('carnes', 'Carnes'),
        ('verduras', 'Verduras'),
        ('bebidas', 'Bebidas'),
        ('harinas', 'Harinas'),
        ('descartables', 'Descartables'),
        ('otros', 'Otros'),
    ]
    UNIT_CHOICES = [
        ('kg', 'kg'),
        ('g', 'g'),
        ('l', 'l'),
        ('ml', 'ml'),
        ('unidad', 'unidad'),
        ('docena', 'docena'),
        ('caja', 'caja'),
        ('bolsa', 'bolsa'),
        ('pack', 'pack'),
    ]

    negocio = models.ForeignKey(Negocio, related_name='ingredients', on_delete=models.CASCADE)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    sku = models.CharField(max_length=80, blank=True)
    category = models.CharField(max_length=30, choices=CATEGORY_CHOICES, default='otros')
    unit = models.CharField(max_length=20, choices=UNIT_CHOICES)
    current_stock = models.DecimalField(max_digits=12, decimal_places=3, default=0)
    minimum_stock = models.DecimalField(max_digits=12, decimal_places=3, default=0)
    purchase_price = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    supplier = models.CharField(max_length=255, blank=True)
    barcode = models.CharField(max_length=120, blank=True)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


class InventoryMovement(models.Model):
    TYPE_PURCHASE = 'purchase'
    TYPE_MANUAL_ADJUSTMENT = 'manual_adjustment'
    TYPE_RECIPE_CONSUMPTION = 'recipe_consumption'
    TYPE_SALE_CONSUMPTION = 'sale_consumption'
    TYPE_LOSS = 'loss'
    TYPE_RETURN = 'return'
    TYPE_CHOICES = [
        (TYPE_PURCHASE, 'Purchase'),
        (TYPE_MANUAL_ADJUSTMENT, 'Manual adjustment'),
        (TYPE_RECIPE_CONSUMPTION, 'Recipe consumption'),
        (TYPE_SALE_CONSUMPTION, 'Sale consumption'),
        (TYPE_LOSS, 'Loss'),
        (TYPE_RETURN, 'Return'),
    ]

    ingredient = models.ForeignKey(Ingredient, related_name='movements', on_delete=models.CASCADE)
    movement_type = models.CharField(max_length=30, choices=TYPE_CHOICES)
    quantity = models.DecimalField(max_digits=12, decimal_places=3)
    previous_stock = models.DecimalField(max_digits=12, decimal_places=3)
    new_stock = models.DecimalField(max_digits=12, decimal_places=3)
    notes = models.TextField(blank=True)
    pedido = models.ForeignKey('pedidos.Pedido', related_name='inventory_movements', on_delete=models.SET_NULL, blank=True, null=True)
    producto = models.ForeignKey('productos.Producto', related_name='inventory_movements', on_delete=models.SET_NULL, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, related_name='inventory_movements', on_delete=models.SET_NULL, blank=True, null=True)

    class Meta:
        ordering = ['-created_at']
