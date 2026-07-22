from django.core.exceptions import ValidationError
from django.conf import settings
from django.db import models

from inventory.models import Ingredient
from negocios.models import Negocio
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


class IngredientCostHistory(models.Model):
    SOURCE_MANUAL = 'manual'
    SOURCE_PURCHASE = 'purchase'
    SOURCE_ADJUSTMENT = 'adjustment'
    SOURCE_CHOICES = [
        (SOURCE_MANUAL, 'Manual'),
        (SOURCE_PURCHASE, 'Purchase'),
        (SOURCE_ADJUSTMENT, 'Adjustment'),
    ]

    ingredient = models.ForeignKey(Ingredient, related_name='cost_history', on_delete=models.CASCADE)
    previous_price = models.DecimalField(max_digits=12, decimal_places=2)
    new_price = models.DecimalField(max_digits=12, decimal_places=2)
    changed_at = models.DateTimeField(auto_now_add=True)
    changed_by = models.ForeignKey(settings.AUTH_USER_MODEL, related_name='ingredient_cost_changes', on_delete=models.SET_NULL, blank=True, null=True)
    source = models.CharField(max_length=20, choices=SOURCE_CHOICES, default=SOURCE_MANUAL)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ['-changed_at']


class ProductCostSnapshot(models.Model):
    TRIGGER_MANUAL = 'manual'
    TRIGGER_INGREDIENT_COST_CHANGE = 'ingredient_cost_change'
    TRIGGER_RECIPE_CHANGE = 'recipe_change'
    TRIGGER_PRODUCT_PRICE_CHANGE = 'product_price_change'
    TRIGGER_CHOICES = [
        (TRIGGER_MANUAL, 'Manual'),
        (TRIGGER_INGREDIENT_COST_CHANGE, 'Ingredient cost change'),
        (TRIGGER_RECIPE_CHANGE, 'Recipe change'),
        (TRIGGER_PRODUCT_PRICE_CHANGE, 'Product price change'),
    ]

    producto = models.ForeignKey(Producto, related_name='cost_snapshots', on_delete=models.CASCADE)
    recipe_cost = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    sale_price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    unit_profit = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    margin_percentage = models.DecimalField(max_digits=8, decimal_places=2, blank=True, null=True)
    markup_percentage = models.DecimalField(max_digits=8, decimal_places=2, blank=True, null=True)
    ingredients_count = models.PositiveIntegerField(default=0)
    incomplete_recipe = models.BooleanField(default=False)
    calculated_at = models.DateTimeField(auto_now_add=True)
    trigger = models.CharField(max_length=40, choices=TRIGGER_CHOICES, default=TRIGGER_MANUAL)

    class Meta:
        ordering = ['-calculated_at']


class ProfitabilityAlert(models.Model):
    TYPE_MARGIN_LOW = 'margin_low'
    TYPE_COST_INCREASE = 'cost_increase'
    TYPE_NEGATIVE_PROFIT = 'negative_profit'
    TYPE_INCOMPLETE_RECIPE = 'incomplete_recipe'
    TYPE_MISSING_INGREDIENT_COST = 'missing_ingredient_cost'
    TYPE_CHOICES = [
        (TYPE_MARGIN_LOW, 'Margin low'),
        (TYPE_COST_INCREASE, 'Cost increase'),
        (TYPE_NEGATIVE_PROFIT, 'Negative profit'),
        (TYPE_INCOMPLETE_RECIPE, 'Incomplete recipe'),
        (TYPE_MISSING_INGREDIENT_COST, 'Missing ingredient cost'),
    ]
    SEVERITY_INFO = 'info'
    SEVERITY_WARNING = 'warning'
    SEVERITY_CRITICAL = 'critical'
    SEVERITY_CHOICES = [
        (SEVERITY_INFO, 'Info'),
        (SEVERITY_WARNING, 'Warning'),
        (SEVERITY_CRITICAL, 'Critical'),
    ]

    negocio = models.ForeignKey(Negocio, related_name='profitability_alerts', on_delete=models.CASCADE)
    producto = models.ForeignKey(Producto, related_name='profitability_alerts', on_delete=models.CASCADE)
    alert_type = models.CharField(max_length=40, choices=TYPE_CHOICES)
    title = models.CharField(max_length=255)
    message = models.TextField()
    severity = models.CharField(max_length=20, choices=SEVERITY_CHOICES, default=SEVERITY_INFO)
    previous_value = models.DecimalField(max_digits=12, decimal_places=2, blank=True, null=True)
    current_value = models.DecimalField(max_digits=12, decimal_places=2, blank=True, null=True)
    read = models.BooleanField(default=False)
    resolved = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    resolved_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        ordering = ['-created_at']
        constraints = [
            models.UniqueConstraint(
                fields=['negocio', 'producto', 'alert_type'],
                condition=models.Q(resolved=False),
                name='unique_active_profitability_alert',
            ),
        ]
