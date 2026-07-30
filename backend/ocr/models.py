from django.db import models

from inventory.models import Ingredient
from purchases.models import Supplier


class IngredientAlias(models.Model):
    ingredient = models.ForeignKey(Ingredient, related_name='ocr_aliases', on_delete=models.CASCADE)
    detected_text = models.CharField(max_length=255)
    supplier = models.ForeignKey(Supplier, related_name='ingredient_aliases', on_delete=models.CASCADE, blank=True, null=True)
    package_type = models.CharField(max_length=20, blank=True)
    content_per_package = models.DecimalField(max_digits=12, decimal_places=3, blank=True, null=True)
    content_unit = models.CharField(max_length=20, blank=True)
    times_confirmed = models.PositiveIntegerField(default=1)
    last_used_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-times_confirmed', '-last_used_at']
        constraints = [
            models.UniqueConstraint(fields=['ingredient', 'detected_text', 'supplier'], name='unique_ingredient_alias_per_supplier'),
        ]

    def __str__(self):
        return f'{self.detected_text} -> {self.ingredient.name}'
