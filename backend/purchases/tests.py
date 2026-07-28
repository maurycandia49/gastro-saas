from decimal import Decimal

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from categorias.models import Categoria
from inventory.models import Ingredient, InventoryMovement
from negocios.models import Negocio
from productos.models import Producto
from recetas.models import IngredientCostHistory, ProductCostSnapshot, RecipeIngredient
from .models import Purchase, Supplier


class PurchaseTests(APITestCase):
    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_user(username='owner', email='o@example.com', password='Pass123456')
        self.other = User.objects.create_user(username='other', email='x@example.com', password='Pass123456')
        self.business = Negocio.objects.create(user=self.user, name='Local', email='l@example.com')
        self.other_business = Negocio.objects.create(user=self.other, name='Otro', email='x@example.com')
        self.supplier = Supplier.objects.create(negocio=self.business, name='Lacteos Don Pepe')
        self.cheese = Ingredient.objects.create(negocio=self.business, name='Mozzarella', unit='g', current_stock=Decimal('1000.000'), minimum_stock=Decimal('500.000'), purchase_price=Decimal('9.00'))
        self.sauce = Ingredient.objects.create(negocio=self.business, name='Salsa', unit='l', current_stock=Decimal('1.000'), purchase_price=Decimal('1000.00'))
        self.salt = Ingredient.objects.create(negocio=self.business, name='Sal fina', unit='kg', current_stock=Decimal('0.000'), purchase_price=Decimal('0.00'))
        self.sugar_g = Ingredient.objects.create(negocio=self.business, name='Azucar gramos', unit='g', current_stock=Decimal('0.000'), purchase_price=Decimal('0.00'))
        category = Categoria.objects.create(negocio=self.business, name='Pizzas')
        product = Producto.objects.create(negocio=self.business, categoria=category, name='Pizza', price=Decimal('5000.00'))
        RecipeIngredient.objects.create(producto=product, ingredient=self.cheese, quantity=Decimal('180.000'), unit='g')
        self.client.force_authenticate(self.user)

    def purchase_payload(self, **kwargs):
        data = {
            'negocio': self.business.id,
            'supplier': self.supplier.id,
            'document_type': 'invoice',
            'document_number': 'A-1',
            'purchase_date': '2026-07-26',
            'taxes': '100.00',
            'discounts': '50.00',
            'items': [
                {'ingredient': self.cheese.id, 'quantity': '10.000', 'unit': 'kg', 'unit_price': '10500.00'},
                {'ingredient': self.sauce.id, 'quantity': '2.000', 'unit': 'l', 'unit_price': '1200.00'},
            ],
        }
        data.update(kwargs)
        return data

    def test_create_supplier_and_isolation(self):
        response = self.client.post(reverse('supplier-list'), {'negocio': self.business.id, 'name': 'Verduleria Norte', 'active': True}, format='json')
        foreign = self.client.post(reverse('supplier-list'), {'negocio': self.other_business.id, 'name': 'Ajeno', 'active': True}, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(foreign.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_draft_with_multiple_lines_totals_and_conversions(self):
        response = self.client.post(reverse('purchase-list'), self.purchase_payload(), format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        purchase = Purchase.objects.get(pk=response.data['id'])
        self.assertEqual(purchase.status, Purchase.STATUS_DRAFT)
        self.assertEqual(purchase.subtotal, Decimal('107400.00'))
        self.assertEqual(purchase.total, Decimal('107450.00'))
        self.assertEqual(purchase.items.get(ingredient=self.cheese).quantity_in_stock_unit, Decimal('10000.000'))

    def test_confirm_purchase_updates_stock_cost_history_and_snapshots(self):
        draft = self.client.post(reverse('purchase-list'), self.purchase_payload(), format='json').data
        response = self.client.post(reverse('purchase-confirm', args=[draft['id']]), format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.cheese.refresh_from_db()
        self.assertEqual(self.cheese.current_stock, Decimal('11000.000'))
        self.assertEqual(self.cheese.purchase_price, Decimal('10.50'))
        self.assertEqual(InventoryMovement.objects.filter(movement_type=InventoryMovement.TYPE_PURCHASE).count(), 2)
        self.assertTrue(IngredientCostHistory.objects.filter(ingredient=self.cheese, source='purchase').exists())
        self.assertTrue(ProductCostSnapshot.objects.exists())
        self.assertEqual(response.data['purchase']['status'], Purchase.STATUS_CONFIRMED)

    def test_cannot_confirm_twice_or_edit_confirmed_critical_fields(self):
        draft = self.client.post(reverse('purchase-list'), self.purchase_payload(), format='json').data
        self.client.post(reverse('purchase-confirm', args=[draft['id']]), format='json')
        second = self.client.post(reverse('purchase-confirm', args=[draft['id']]), format='json')
        edit = self.client.patch(reverse('purchase-detail', args=[draft['id']]), {'taxes': '1.00'}, format='json')

        self.assertEqual(second.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(edit.status_code, status.HTTP_400_BAD_REQUEST)

    def test_cancel_draft_and_delete_only_draft(self):
        draft = self.client.post(reverse('purchase-list'), self.purchase_payload(), format='json').data
        cancel = self.client.post(reverse('purchase-cancel', args=[draft['id']]), format='json')

        self.assertEqual(cancel.status_code, status.HTTP_200_OK)
        self.assertEqual(cancel.data['status'], Purchase.STATUS_CANCELLED)

    def test_invalid_unit_total_and_foreign_business(self):
        invalid_unit = self.client.post(reverse('purchase-list'), self.purchase_payload(items=[{'ingredient': self.cheese.id, 'quantity': '1.000', 'unit': 'l', 'unit_price': '1.00'}]), format='json')
        negative_total = self.client.post(reverse('purchase-list'), self.purchase_payload(taxes='0.00', discounts='999999.00'), format='json')
        foreign = self.client.post(reverse('purchase-list'), self.purchase_payload(negocio=self.other_business.id), format='json')

        self.assertEqual(invalid_unit.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(negative_total.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(foreign.status_code, status.HTTP_400_BAD_REQUEST)

    def test_summary_month(self):
        draft = self.client.post(reverse('purchase-list'), self.purchase_payload(), format='json').data
        self.client.post(reverse('purchase-confirm', args=[draft['id']]), format='json')
        response = self.client.get(reverse('purchase-summary'), {'business_id': self.business.id, 'period': 'month'})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['purchases_count'], 1)
        self.assertEqual(response.data['top_supplier']['name'], self.supplier.name)
        self.assertIsNotNone(response.data['top_ingredient_by_spend'])

    def test_one_bag_25kg_updates_stock_and_real_unit_cost(self):
        payload = self.purchase_payload(
            taxes='0.00',
            discounts='0.00',
            items=[{
                'ingredient': self.salt.id,
                'package_quantity': '1.000',
                'package_type': 'bag',
                'content_per_package': '25.000',
                'content_unit': 'kg',
                'total_price': '12000.00',
            }],
        )
        draft_response = self.client.post(reverse('purchase-list'), payload, format='json')

        self.assertEqual(draft_response.status_code, status.HTTP_201_CREATED)
        draft_item = draft_response.data['items'][0]
        self.assertEqual(Decimal(draft_item['quantity']), Decimal('25.000'))
        self.assertEqual(draft_item['unit'], 'kg')
        self.assertEqual(Decimal(draft_item['total_content_in_stock_unit']), Decimal('25.000'))
        self.assertEqual(Decimal(draft_item['unit_cost_in_stock_unit']), Decimal('480.00'))
        self.assertEqual(Decimal(draft_item['subtotal']), Decimal('12000.00'))

        confirm_response = self.client.post(reverse('purchase-confirm', args=[draft_response.data['id']]), format='json')

        self.assertEqual(confirm_response.status_code, status.HTTP_200_OK)
        self.salt.refresh_from_db()
        self.assertEqual(self.salt.current_stock, Decimal('25.000'))
        self.assertEqual(self.salt.purchase_price, Decimal('480.00'))

    def test_multiple_bags_and_kg_to_g_conversion(self):
        payload = self.purchase_payload(
            taxes='0.00',
            discounts='0.00',
            items=[{
                'ingredient': self.sugar_g.id,
                'package_quantity': '2.000',
                'package_type': 'bag',
                'content_per_package': '25.000',
                'content_unit': 'kg',
                'total_price': '24000.00',
            }],
        )

        draft = self.client.post(reverse('purchase-list'), payload, format='json').data
        self.client.post(reverse('purchase-confirm', args=[draft['id']]), format='json')

        self.sugar_g.refresh_from_db()
        self.assertEqual(self.sugar_g.current_stock, Decimal('50000.000'))
        self.assertEqual(self.sugar_g.purchase_price, Decimal('0.48'))

    def test_boxes_with_units_and_bottles_with_liters(self):
        unit_item = Ingredient.objects.create(negocio=self.business, name='Gaseosa lata', unit='unidad', current_stock=Decimal('0.000'), purchase_price=Decimal('0.00'))
        oil = Ingredient.objects.create(negocio=self.business, name='Aceite', unit='l', current_stock=Decimal('0.000'), purchase_price=Decimal('0.00'))
        payload = self.purchase_payload(
            taxes='0.00',
            discounts='0.00',
            items=[
                {'ingredient': unit_item.id, 'package_quantity': '2.000', 'package_type': 'box', 'content_per_package': '12.000', 'content_unit': 'unidad', 'total_price': '36000.00'},
                {'ingredient': oil.id, 'package_quantity': '5.000', 'package_type': 'bottle', 'content_per_package': '5.000', 'content_unit': 'l', 'total_price': '50000.00'},
            ],
        )

        draft = self.client.post(reverse('purchase-list'), payload, format='json').data
        self.client.post(reverse('purchase-confirm', args=[draft['id']]), format='json')

        unit_item.refresh_from_db()
        oil.refresh_from_db()
        self.assertEqual(unit_item.current_stock, Decimal('24.000'))
        self.assertEqual(unit_item.purchase_price, Decimal('1500.00'))
        self.assertEqual(oil.current_stock, Decimal('25.000'))
        self.assertEqual(oil.purchase_price, Decimal('2000.00'))

    def test_purchase_package_invalid_values_and_rollback(self):
        payload = self.purchase_payload(
            items=[{
                'ingredient': self.salt.id,
                'package_quantity': '0.000',
                'package_type': 'bag',
                'content_per_package': '25.000',
                'content_unit': 'kg',
                'total_price': '12000.00',
            }],
        )

        response = self.client.post(reverse('purchase-list'), payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(Purchase.objects.filter(document_number='A-1').exists())

    def test_legacy_purchase_items_remain_compatible(self):
        draft = self.client.post(reverse('purchase-list'), self.purchase_payload(taxes='0.00', discounts='0.00'), format='json').data
        item = Purchase.objects.get(pk=draft['id']).items.get(ingredient=self.cheese)

        self.assertEqual(item.package_quantity, Decimal('1.000'))
        self.assertEqual(item.package_type, 'unit')
        self.assertEqual(item.content_per_package, Decimal('10.000'))
        self.assertEqual(item.content_unit, 'kg')
        self.assertEqual(item.total_price, Decimal('105000.00'))
