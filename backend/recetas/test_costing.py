from decimal import Decimal

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from categorias.models import Categoria
from inventory.models import Ingredient
from negocios.models import ConfiguracionNegocio, Negocio
from productos.models import Producto
from .costing import calculate_product_cost, calculate_suggested_price, create_snapshot_if_changed, recalculate_products_using_ingredient
from .models import IngredientCostHistory, ProductCostSnapshot, ProfitabilityAlert, RecipeIngredient


class CostingTests(APITestCase):
    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_user(username='owner', email='o@example.com', password='Pass123456')
        self.other = User.objects.create_user(username='other', email='x@example.com', password='Pass123456')
        self.business = Negocio.objects.create(user=self.user, name='Local', email='l@example.com')
        ConfiguracionNegocio.objects.create(negocio=self.business, low_margin_threshold=Decimal('30.00'), cost_increase_alert_percentage=Decimal('10.00'))
        self.category = Categoria.objects.create(negocio=self.business, name='Pizzas')
        self.product = Producto.objects.create(negocio=self.business, categoria=self.category, name='Napolitana', price=Decimal('1000.00'))
        self.cheese = Ingredient.objects.create(negocio=self.business, name='Mozzarella', unit='kg', current_stock=Decimal('10.000'), purchase_price=Decimal('3000.00'))
        self.sauce = Ingredient.objects.create(negocio=self.business, name='Salsa', unit='l', current_stock=Decimal('5.000'), purchase_price=Decimal('0.00'))
        RecipeIngredient.objects.create(producto=self.product, ingredient=self.cheese, quantity=Decimal('100.000'), unit='g', waste_percentage=Decimal('10.00'))
        self.client.force_authenticate(self.user)

    def test_calculates_cost_margin_markup_breakdown_and_suggested_price(self):
        data = calculate_product_cost(self.product)
        suggestion = calculate_suggested_price(self.product, Decimal('35.00'))

        self.assertEqual(data['recipe_cost'], Decimal('330.00'))
        self.assertEqual(data['unit_profit'], Decimal('670.00'))
        self.assertEqual(data['margin_percentage'], Decimal('67.00'))
        self.assertEqual(data['markup_percentage'], Decimal('203.03'))
        self.assertEqual(data['cost_breakdown'][0]['effective_quantity'], Decimal('0.1100000'))
        self.assertEqual(data['cost_breakdown'][0]['percentage_of_total_cost'], Decimal('100.00'))
        self.assertEqual(suggestion['suggested_price'], Decimal('507.69'))

    def test_snapshot_is_not_duplicated_when_values_do_not_change(self):
        first, first_created = create_snapshot_if_changed(self.product, ProductCostSnapshot.TRIGGER_MANUAL)
        second, second_created = create_snapshot_if_changed(self.product, ProductCostSnapshot.TRIGGER_MANUAL)

        self.assertTrue(first_created)
        self.assertFalse(second_created)
        self.assertEqual(first.id, second.id)
        self.assertEqual(self.product.cost_snapshots.count(), 1)

    def test_ingredient_price_update_creates_history_and_impact(self):
        response = self.client.patch(reverse('inventory-detail', args=[self.cheese.id]), {'purchase_price': '6000.00'}, format='json')

        self.cheese.refresh_from_db()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(IngredientCostHistory.objects.count(), 1)
        self.assertEqual(self.cheese.purchase_price, Decimal('6000.00'))
        self.assertEqual(response.data['affected_products_count'], 1)
        self.assertEqual(ProductCostSnapshot.objects.filter(producto=self.product).count(), 1)

    def test_no_history_when_price_does_not_change(self):
        response = self.client.patch(reverse('inventory-detail', args=[self.cheese.id]), {'purchase_price': '3000.00'}, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(IngredientCostHistory.objects.count(), 0)

    def test_profitability_alerts_are_created_and_not_duplicated(self):
        self.product.price = Decimal('100.00')
        self.product.save()

        affected = recalculate_products_using_ingredient(self.cheese)
        recalculate_products_using_ingredient(self.cheese)

        self.assertEqual(len(affected), 1)
        self.assertEqual(ProfitabilityAlert.objects.filter(producto=self.product, alert_type=ProfitabilityAlert.TYPE_NEGATIVE_PROFIT, resolved=False).count(), 1)
        self.assertEqual(ProfitabilityAlert.objects.filter(producto=self.product, alert_type=ProfitabilityAlert.TYPE_MARGIN_LOW, resolved=False).count(), 1)

    def test_costing_endpoints_are_isolated(self):
        other_business = Negocio.objects.create(user=self.other, name='Otro', email='x@example.com')
        other_category = Categoria.objects.create(negocio=other_business, name='Otros')
        other_product = Producto.objects.create(negocio=other_business, categoria=other_category, name='Secreta', price=Decimal('1.00'))

        list_response = self.client.get(reverse('costing_products'), {'business_id': self.business.id})
        detail_response = self.client.get(reverse('costing_product_detail', args=[other_product.id]))

        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(list_response.data), 1)
        self.assertEqual(detail_response.status_code, status.HTTP_404_NOT_FOUND)

    def test_invalid_target_margin(self):
        response = self.client.get(reverse('costing_suggested_price', args=[self.product.id]), {'target_margin': 100})

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
