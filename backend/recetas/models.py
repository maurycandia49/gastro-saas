from django.core.exceptions import ValidationError
from django.db import models

from inventory.models import Ingredient
from productos.models import Producto
from .conversions import validate_compatible_units


class RecipeIngredient(models.Model):
    producto = models.ForeignKey(Producto, related_name='recipe_items', on_delete=models.CASCADE)
    ingredient = models.ForeignKey(Ingredient, related_name='recipe_items', on_delete=models.CASCADE)
    quantity = models.DecimalField(max_digits=12, decimal_places=3)
    unit = models.CharField(max_length=20, choices=Ingredient.UNIT_CHOICES)
    waste_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['ingredient__name']
        constraints = [
            models.UniqueConstraint(fields=['producto', 'ingredient'], name='unique_recipe_ingredient'),
        ]

    def clean(self):
        if self.producto_id and self.ingredient_id and self.producto.negocio_id != self.ingredient.negocio_id:
            raise ValidationError('El ingrediente y el producto deben pertenecer al mismo negocio.')
        if self.quantity <= 0:
            raise ValidationError({'quantity': 'La cantidad debe ser mayor que cero.'})
        if self.waste_percentage < 0 or self.waste_percentage > 100:
            raise ValidationError({'waste_percentage': 'La merma debe estar entre 0 y 100.'})
        if self.ingredient_id:
            validate_compatible_units(self.unit, self.ingredient.unit)

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)
