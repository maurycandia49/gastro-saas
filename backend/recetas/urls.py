from django.urls import path

from .costing_views import (
    ApplySuggestedPriceView,
    CostingProductDetailView,
    CostingProductRecalculateView,
    CostingProductsView,
    CostingSummaryView,
    IngredientCostImpactView,
    ProfitabilityAlertDetailView,
    ProfitabilityAlertsView,
    SuggestedPriceView,
)
from .views import ProductRecipeItemDeleteView, ProductRecipeView

urlpatterns = [
    path('products/<int:product_id>/recipe/', ProductRecipeView.as_view(), name='product_recipe'),
    path('products/<int:product_id>/recipe/<int:item_id>/', ProductRecipeItemDeleteView.as_view(), name='product_recipe_item'),
    path('costing/products/', CostingProductsView.as_view(), name='costing_products'),
    path('costing/products/<int:product_id>/', CostingProductDetailView.as_view(), name='costing_product_detail'),
    path('costing/products/<int:product_id>/recalculate/', CostingProductRecalculateView.as_view(), name='costing_product_recalculate'),
    path('costing/products/<int:product_id>/suggested-price/', SuggestedPriceView.as_view(), name='costing_suggested_price'),
    path('costing/products/<int:product_id>/apply-suggested-price/', ApplySuggestedPriceView.as_view(), name='costing_apply_suggested_price'),
    path('costing/summary/', CostingSummaryView.as_view(), name='costing_summary'),
    path('profitability-alerts/', ProfitabilityAlertsView.as_view(), name='profitability_alerts'),
    path('profitability-alerts/<int:alert_id>/', ProfitabilityAlertDetailView.as_view(), name='profitability_alert_detail'),
    path('inventory/<int:ingredient_id>/cost-impact/', IngredientCostImpactView.as_view(), name='ingredient_cost_impact'),
]
