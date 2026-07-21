from decimal import Decimal

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from negocios.models import Negocio
from .models import Ingredient, InventoryMovement


class InventoryAPITests(APITestCase):
    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_user(username='owner', email='o@example.com', password='Pass123456')
        self.other = User.objects.create_user(username='other', email='x@example.com', password='Pass123456')
        self.business = Negocio.objects.create(user=self.user, name='Local', email='l@example.com')
        self.other_business = Negocio.objects.create(user=self.other, name='Otro', email='x@example.com')
        self.client.force_authenticate(self.user)

    def payload(self, **kwargs):
        data = {
            'negocio': self.business.id,
            'name': 'Mozzarella',
            'description': '',
            'sku': 'MOZ',
            'category': 'lacteos',
            'unit': 'kg',
            'current_stock': '10.000',
            'minimum_stock': '3.000',
            'purchase_price': '2500.00',
            'supplier': 'Proveedor',
            'barcode': '',
            'active': True,
        }
        data.update(kwargs)
        return data

    def create_ingredient(self, **kwargs):
        data = {
            'negocio': self.business,
            'name': 'Harina',
            'category': 'harinas',
            'unit': 'kg',
            'current_stock': '5.000',
            'minimum_stock': '2.000',
            'purchase_price': '1000.00',
        }
        data.update(kwargs)
        return Ingredient.objects.create(**data)

    def test_create_edit_delete_ingredient(self):
        created = self.client.post(reverse('inventory-list'), self.payload(), format='json')
        self.assertEqual(created.status_code, status.HTTP_201_CREATED)
        updated = self.client.patch(reverse('inventory-detail', kwargs={'pk': created.data['id']}), {'name': 'Muzza'}, format='json')
        self.assertEqual(updated.status_code, status.HTTP_200_OK)
        deleted = self.client.delete(reverse('inventory-detail', kwargs={'pk': created.data['id']}))
        self.assertEqual(deleted.status_code, status.HTTP_204_NO_CONTENT)

    def test_increase_decrease_adjust_create_movements(self):
        ingredient = self.create_ingredient()
        increase = self.client.post(reverse('inventory-increase', kwargs={'pk': ingredient.pk}), {'quantity': '3.000', 'notes': 'Compra'}, format='json')
        decrease = self.client.post(reverse('inventory-decrease', kwargs={'pk': ingredient.pk}), {'quantity': '2.000', 'notes': 'Merma'}, format='json')
        adjust = self.client.post(reverse('inventory-adjust', kwargs={'pk': ingredient.pk}), {'quantity': '20.000', 'notes': 'Conteo'}, format='json')

        self.assertEqual(increase.status_code, status.HTTP_201_CREATED)
        self.assertEqual(decrease.status_code, status.HTTP_201_CREATED)
        self.assertEqual(adjust.status_code, status.HTTP_201_CREATED)
        ingredient.refresh_from_db()
        self.assertEqual(ingredient.current_stock, Decimal('20.000'))
        self.assertEqual(InventoryMovement.objects.count(), 3)

    def test_no_negative_stock_or_quantity(self):
        ingredient = self.create_ingredient()
        negative_qty = self.client.post(reverse('inventory-increase', kwargs={'pk': ingredient.pk}), {'quantity': '-1.000'}, format='json')
        negative_stock = self.client.post(reverse('inventory-decrease', kwargs={'pk': ingredient.pk}), {'quantity': '99.000'}, format='json')

        self.assertEqual(negative_qty.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(negative_stock.status_code, status.HTTP_400_BAD_REQUEST)

    def test_isolation_between_users(self):
        other = Ingredient.objects.create(negocio=self.other_business, name='Ajeno', category='otros', unit='unidad')
        response = self.client.get(reverse('inventory-detail', kwargs={'pk': other.pk}))
        create = self.client.post(reverse('inventory-list'), self.payload(negocio=self.other_business.id), format='json')

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(create.status_code, status.HTTP_400_BAD_REQUEST)

    def test_filters_summary_value_and_low_stock(self):
        self.create_ingredient(current_stock='1.000', minimum_stock='2.000', supplier='A')
        self.create_ingredient(name='Coca', category='bebidas', unit='unidad', current_stock='10.000', minimum_stock='1.000', purchase_price='500.00', supplier='B')

        low = self.client.get(reverse('inventory-list'), {'low_stock': 'true'})
        category = self.client.get(reverse('inventory-list'), {'category': 'bebidas'})
        summary = self.client.get(reverse('inventory-summary'))

        self.assertEqual(len(low.data), 1)
        self.assertEqual(len(category.data), 1)
        self.assertEqual(summary.data['total_ingredients'], 2)
        self.assertEqual(Decimal(summary.data['inventory_value']), Decimal('6000.00'))
        self.assertEqual(summary.data['low_stock'], 1)

    def test_movements_endpoint(self):
        ingredient = self.create_ingredient()
        self.client.post(reverse('inventory-increase', kwargs={'pk': ingredient.pk}), {'quantity': '1.000'}, format='json')
        response = self.client.get(reverse('inventory-movements', kwargs={'pk': ingredient.pk}))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
