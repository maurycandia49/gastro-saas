from django.urls import path

from .views import ProductRecipeItemDeleteView, ProductRecipeView

urlpatterns = [
    path('products/<int:product_id>/recipe/', ProductRecipeView.as_view(), name='product_recipe'),
    path('products/<int:product_id>/recipe/<int:item_id>/', ProductRecipeItemDeleteView.as_view(), name='product_recipe_item'),
]
