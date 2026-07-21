from django.db import models

from categorias.models import Categoria
from negocios.models import Negocio
from productos.models import Producto


class Promocion(models.Model):
    TYPE_PERCENTAGE = 'percentage'
    TYPE_FIXED_PRICE = 'fixed_price'

    TYPE_CHOICES = [
        (TYPE_PERCENTAGE, 'Percentage'),
        (TYPE_FIXED_PRICE, 'Fixed price'),
    ]

    negocio = models.ForeignKey(Negocio, related_name='promociones', on_delete=models.CASCADE)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    promotion_type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    percentage_discount = models.DecimalField(max_digits=5, decimal_places=2, blank=True, null=True)
    fixed_price = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    producto = models.ForeignKey(Producto, related_name='promociones', on_delete=models.CASCADE, blank=True, null=True)
    categoria = models.ForeignKey(Categoria, related_name='promociones', on_delete=models.CASCADE, blank=True, null=True)
    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField()
    active = models.BooleanField(default=True)
    featured = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.name
