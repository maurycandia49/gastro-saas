from decimal import Decimal

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from categorias.models import Categoria
from inventory.models import Ingredient
from pedidos.models import Pedido
from productos.models import Producto
from promociones.models import Promocion
from .models import Negocio


class GlobalSearchTests(APITestCase):
    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_user(username='owner', email='o@example.com', password='Pass123456')
        self.other = User.objects.create_user(username='other', email='x@example.com', password='Pass123456')
        self.business = Negocio.objects.create(user=self.user, name='Local', email='l@example.com')
        self.other_business = Negocio.objects.create(user=self.other, name='Otro', email='x@example.com')
        self.category = Categoria.objects.create(negocio=self.business, name='Pizzas', description='Horno de piedra')
        self.product = Producto.objects.create(negocio=self.business, categoria=self.category, name='Pizza Mozzarella', description='Muzza grande', price=Decimal('9000.00'))
        self.order = Pedido.objects.create(negocio=self.business, customer_name='Juan Perez', customer_phone='11 5555-1111', delivery_address='Calle 1', total=Decimal('9000.00'))
        self.ingredient = Ingredient.objects.create(negocio=self.business, name='Mozzarella Barraza', sku='MOZ-001', barcode='779001', supplier='Barraza', unit='kg', purchase_price=Decimal('9200.00'))
        self.promotion = Promocion.objects.create(negocio=self.business, name='Promo Mozzarella', description='Martes', promotion_type='percentage', percentage_discount=Decimal('20.00'), producto=self.product, starts_at='2026-01-01T00:00:00Z', ends_at='2027-01-01T00:00:00Z')
        other_category = Categoria.objects.create(negocio=self.other_business, name='Secreta')
        Producto.objects.create(negocio=self.other_business, categoria=other_category, name='Pizza Ajena', price=Decimal('1.00'))
        self.client.force_authenticate(self.user)

    def search(self, query, business_id=None):
        return self.client.get(reverse('global_search'), {'business_id': business_id or self.business.id, 'q': query})

    def test_grouped_results_and_partial_matches(self):
        response = self.search('moz')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['products'])
        self.assertTrue(response.data['inventory'])
        self.assertTrue(response.data['promotions'])
        self.assertTrue(response.data['costing'])
        self.assertIn('categories', response.data)
        self.assertIn('orders', response.data)
        self.assertIn('customers', response.data)

    def test_search_by_order_customer_and_customer_phone(self):
        by_name = self.search('Juan')
        by_phone = self.search('5555')

        self.assertEqual(by_name.data['orders'][0]['id'], self.order.id)
        self.assertEqual(by_phone.data['customers'][0]['id'], '1155551111')

    def test_search_by_sku(self):
        response = self.search('MOZ-001')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['inventory'][0]['id'], self.ingredient.id)

    def test_empty_or_short_query_returns_empty_groups(self):
        response = self.search('m')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(all(results == [] for results in response.data.values()))

    def test_foreign_business_is_not_accessible(self):
        response = self.search('Pizza', self.other_business.id)

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_limits_results_per_group(self):
        for index in range(8):
            Producto.objects.create(negocio=self.business, categoria=self.category, name=f'Pizza Especial {index}', price=Decimal('100.00'))

        response = self.search('Pizza')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertLessEqual(len(response.data['products']), 5)
