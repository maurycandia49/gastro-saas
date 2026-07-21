from decimal import Decimal

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from categorias.models import Categoria
from inventory.models import Ingredient, InventoryMovement
from negocios.models import ConfiguracionNegocio, Negocio
from pedidos.models import Pedido
from productos.models import Producto
from .conversions import convert_quantity
from .models import RecipeIngredient
from .services import calculate_available_units, calculate_product_recipe_cost


class RecipeTests(APITestCase):
    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_user(username='owner', email='o@example.com', password='Pass123456')
        self.other = User.objects.create_user(username='other', email='x@example.com', password='Pass123456')
        self.business = Negocio.objects.create(user=self.user, name='Local', email='l@example.com')
        self.other_business = Negocio.objects.create(user=self.other, name='Otro', email='x@example.com')
        self.category = Categoria.objects.create(negocio=self.business, name='Pizzas')
        self.product = Producto.objects.create(negocio=self.business, categoria=self.category, name='Pizza', price='1000.00', available=True)
        self.ingredient = Ingredient.objects.create(negocio=self.business, name='Mozzarella', unit='kg', current_stock='2.000', minimum_stock='0.100', purchase_price='3000.00')
        self.client.force_authenticate(self.user)

    def test_create_edit_delete_recipe_and_validations(self):
        response = self.client.post(reverse('product_recipe', kwargs={'product_id': self.product.id}), {'ingredient': self.ingredient.id, 'quantity': '180.000', 'unit': 'g', 'waste_percentage': '10.00'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(RecipeIngredient.objects.count(), 1)
        duplicate = self.client.post(reverse('product_recipe', kwargs={'product_id': self.product.id}), {'ingredient': self.ingredient.id, 'quantity': '1.000', 'unit': 'kg'}, format='json')
        self.assertEqual(duplicate.status_code, status.HTTP_400_BAD_REQUEST)
        item_id = RecipeIngredient.objects.get().id
        deleted = self.client.delete(reverse('product_recipe_item', kwargs={'product_id': self.product.id, 'item_id': item_id}))
        self.assertEqual(deleted.status_code, status.HTTP_200_OK)

    def test_conversions_waste_cost_available_units_and_limiting_ingredient(self):
        self.assertEqual(convert_quantity(Decimal('1.000'), 'kg', 'g'), Decimal('1000.000'))
        RecipeIngredient.objects.create(producto=self.product, ingredient=self.ingredient, quantity='180.000', unit='g', waste_percentage='10.00')
        cost = calculate_product_recipe_cost(self.product)
        availability = calculate_available_units(self.product)
        self.assertEqual(cost['recipe_cost'], Decimal('594.000000000'))
        self.assertEqual(availability['available_units'], 10)
        self.assertEqual(availability['limiting_ingredient'], 'Mozzarella')

    def test_order_consumes_stock_and_cancel_restores_once(self):
        RecipeIngredient.objects.create(producto=self.product, ingredient=self.ingredient, quantity='500.000', unit='g')
        payload = {'business_id': self.business.id, 'customer_name': 'Juan', 'delivery_address': 'Calle', 'items': [{'product_id': self.product.id, 'quantity': 2}]}
        response = self.client.post(reverse('public_order_create'), payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.ingredient.refresh_from_db()
        self.assertEqual(self.ingredient.current_stock, Decimal('1.000'))
        self.assertEqual(InventoryMovement.objects.filter(movement_type=InventoryMovement.TYPE_SALE_CONSUMPTION).count(), 1)
        order_id = response.data['id']
        cancel = self.client.patch(reverse('order-detail', kwargs={'pk': order_id}), {'status': Pedido.STATUS_CANCELLED}, format='json')
        self.assertEqual(cancel.status_code, status.HTTP_200_OK)
        second_cancel = self.client.patch(reverse('order-detail', kwargs={'pk': order_id}), {'status': Pedido.STATUS_CANCELLED}, format='json')
        self.assertEqual(second_cancel.status_code, status.HTTP_200_OK)
        self.ingredient.refresh_from_db()
        self.assertEqual(self.ingredient.current_stock, Decimal('2.000'))
        self.assertEqual(InventoryMovement.objects.filter(movement_type=InventoryMovement.TYPE_RETURN).count(), 1)
        reopen = self.client.patch(reverse('order-detail', kwargs={'pk': order_id}), {'status': Pedido.STATUS_ACCEPTED}, format='json')
        self.assertEqual(reopen.status_code, status.HTTP_400_BAD_REQUEST)

    def test_insufficient_stock_policy_and_public_menu_stock_flag(self):
        ConfiguracionNegocio.objects.update_or_create(negocio=self.business, defaults={'prevent_sales_without_stock': True})
        RecipeIngredient.objects.create(producto=self.product, ingredient=self.ingredient, quantity='3.000', unit='kg')
        payload = {'business_id': self.business.id, 'customer_name': 'Juan', 'delivery_address': 'Calle', 'items': [{'product_id': self.product.id, 'quantity': 1}]}
        response = self.client.post(reverse('public_order_create'), payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Pedido.objects.count(), 0)
        menu = self.client.get(reverse('public_menu', kwargs={'business_id': self.business.id}))
        self.assertTrue(menu.data['categorias'][0]['productos'][0]['out_of_operational_stock'])

    def test_product_and_ingredient_isolation(self):
        other_product = Producto.objects.create(negocio=self.other_business, categoria=Categoria.objects.create(negocio=self.other_business, name='O'), name='Otro', price='1.00')
        response = self.client.get(reverse('product_recipe', kwargs={'product_id': other_product.id}))
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
