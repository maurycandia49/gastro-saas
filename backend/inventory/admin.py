from django.contrib import admin

from .models import Ingredient, InventoryMovement


@admin.register(Ingredient)
class IngredientAdmin(admin.ModelAdmin):
    list_display = ['name', 'negocio', 'category', 'current_stock', 'minimum_stock', 'unit', 'active']
    list_filter = ['category', 'unit', 'active']


@admin.register(InventoryMovement)
class InventoryMovementAdmin(admin.ModelAdmin):
    list_display = ['ingredient', 'movement_type', 'quantity', 'previous_stock', 'new_stock', 'created_at']
    list_filter = ['movement_type', 'created_at']
