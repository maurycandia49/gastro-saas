from django.db import models

from categorias.models import Categoria
from negocios.models import Negocio


class Producto(models.Model):
    negocio = models.ForeignKey(
        Negocio,
        related_name='productos',
        on_delete=models.CASCADE,
    )
    categoria = models.ForeignKey(
        Categoria,
        related_name='productos',
        on_delete=models.CASCADE,
    )
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    image = models.ImageField(upload_to='productos/', blank=True, null=True)
    available = models.BooleanField(default=True)
    featured = models.BooleanField(default=False)
    order = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['order', 'name']

    def __str__(self):
        return self.name
