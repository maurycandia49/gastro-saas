from decimal import Decimal

from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from categorias.models import Categoria
from negocios.models import Negocio
from productos.models import Producto
from .models import DetallePedido, Pedido


class CustomerAPITests(APITestCase):
    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_user(username='owner', email='owner@example.com', password='SecurePass123')
        self.other_user = User.objects.create_user(username='other', email='other@example.com', password='SecurePass123')
        self.negocio = Negocio.objects.create(user=self.user, name='Pizzeria', phone='123', email='pizza@example.com')
        self.other_negocio = Negocio.objects.create(user=self.other_user, name='Otro', phone='999', email='otro@example.com')
        self.categoria = Categoria.objects.create(negocio=self.negocio, name='Pizzas')
        self.product = Producto.objects.create(negocio=self.negocio, categoria=self.categoria, name='Muzzarella', price='1000.00')
        self.second_product = Producto.objects.create(negocio=self.negocio, categoria=self.categoria, name='Coca Cola', price='500.00')
        self.client.force_authenticate(self.user)

    def create_order(self, phone, total='1000.00', name='Juan', status_value=Pedido.STATUS_DELIVERED, address='Calle 1'):
        order = Pedido.objects.create(
            negocio=self.negocio,
            customer_name=name,
            customer_phone=phone,
            delivery_address=address,
            status=status_value,
            total=total,
        )
        DetallePedido.objects.create(
            pedido=order,
            producto=self.product,
            product_name=self.product.name,
            unit_price=Decimal('1000.00'),
            unit_cost=Decimal('400.00'),
            quantity=1,
            subtotal=Decimal('1000.00'),
            subtotal_cost=Decimal('400.00'),
            profit=Decimal('600.00'),
        )
        return order

    def list_response(self, business_id=None):
        return self.client.get(reverse('customer_list'), {'business_id': business_id or self.negocio.id})

    def test_consolidates_customers_by_normalized_phone(self):
        self.create_order('+54 11-1234-5678', total='1000.00', name='Juan')
        self.create_order('(54) 11 1234 5678', total='2000.00', name='Juan Actualizado')

        response = self.list_response()

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['phone'], '541112345678')
        self.assertEqual(response.data[0]['name'], 'Juan Actualizado')

    def test_excludes_cancelled_orders_from_customer_metrics(self):
        self.create_order('111', total='1000.00')
        self.create_order('111', total='5000.00', status_value=Pedido.STATUS_CANCELLED)

        response = self.list_response()

        self.assertEqual(response.data[0]['orders_count'], 1)
        self.assertEqual(Decimal(response.data[0]['total_spent']), Decimal('1000.00'))

    def test_total_spent_average_ticket_and_recurring(self):
        self.create_order('222', total='1000.00')
        self.create_order('222', total='3000.00')

        response = self.list_response()

        self.assertEqual(response.data[0]['orders_count'], 2)
        self.assertEqual(Decimal(response.data[0]['total_spent']), Decimal('4000.00'))
        self.assertEqual(Decimal(response.data[0]['average_ticket']), Decimal('2000.00'))
        self.assertTrue(response.data[0]['is_recurring'])

    def test_vip_ranking_uses_top_10_by_spend(self):
        for index in range(11):
            self.create_order(str(index), total=str((index + 1) * 100))

        response = self.list_response()

        vip_customers = [customer for customer in response.data if customer['is_vip']]
        self.assertEqual(len(vip_customers), 10)
        self.assertFalse(next(customer for customer in response.data if customer['phone'] == '0')['is_vip'])

    def test_customer_detail_includes_history_favorites_addresses_and_frequency(self):
        first = self.create_order('333', total='1000.00', address='Calle 1')
        Pedido.objects.filter(pk=first.pk).update(created_at=timezone.now() - timezone.timedelta(days=10))
        second = self.create_order('333', total='1500.00', address='Calle 2')
        DetallePedido.objects.create(
            pedido=second,
            producto=self.second_product,
            product_name=self.second_product.name,
            unit_price=Decimal('500.00'),
            unit_cost=Decimal('100.00'),
            quantity=2,
            subtotal=Decimal('1000.00'),
            subtotal_cost=Decimal('200.00'),
            profit=Decimal('800.00'),
        )

        response = self.client.get(reverse('customer_detail', kwargs={'phone': '333'}), {'business_id': self.negocio.id})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['orders']), 2)
        self.assertIn('Calle 1', response.data['addresses'])
        self.assertIn('Calle 2', response.data['addresses'])
        self.assertEqual(response.data['favorite_products'][0]['product_name'], 'Muzzarella')
        self.assertIsNotNone(response.data['frequency_days'])

    def test_isolation_between_users_and_foreign_business(self):
        self.create_order('444', total='1000.00')
        Pedido.objects.create(negocio=self.other_negocio, customer_name='Ana', customer_phone='999', delivery_address='Otra', total='9000.00')

        own = self.list_response()
        foreign = self.list_response(self.other_negocio.id)

        self.assertEqual(len(own.data), 1)
        self.assertEqual(foreign.status_code, status.HTTP_404_NOT_FOUND)

    def test_unknown_business_and_missing_customer_return_404(self):
        business_response = self.list_response(99999)
        customer_response = self.client.get(reverse('customer_detail', kwargs={'phone': '000'}), {'business_id': self.negocio.id})

        self.assertEqual(business_response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(customer_response.status_code, status.HTTP_404_NOT_FOUND)

    def test_orders_without_phone_are_not_included(self):
        self.create_order('', total='1000.00')

        response = self.list_response()

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, [])
