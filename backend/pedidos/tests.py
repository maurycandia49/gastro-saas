from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from categorias.models import Categoria
from negocios.models import Negocio
from productos.models import Producto
from .models import DetallePedido, Pedido


class PedidoAPITests(APITestCase):
    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_user(username='owner', email='owner@example.com', password='SecurePass123')
        self.other_user = User.objects.create_user(username='other', email='other@example.com', password='SecurePass123')
        self.negocio = Negocio.objects.create(user=self.user, name='Pizzeria', phone='5491112345678', email='pizza@example.com')
        self.other_negocio = Negocio.objects.create(user=self.other_user, name='Hamburguesas', phone='5491199999999', email='burger@example.com')
        self.categoria = Categoria.objects.create(negocio=self.negocio, name='Pizzas')
        self.other_categoria = Categoria.objects.create(negocio=self.other_negocio, name='Burgers')
        self.product = Producto.objects.create(negocio=self.negocio, categoria=self.categoria, name='Muzzarella', price='1000.00', available=True)
        self.second_product = Producto.objects.create(negocio=self.negocio, categoria=self.categoria, name='Coca Cola', price='500.00', available=True)
        self.unavailable_product = Producto.objects.create(negocio=self.negocio, categoria=self.categoria, name='Faina', price='300.00', available=False)
        self.other_product = Producto.objects.create(negocio=self.other_negocio, categoria=self.other_categoria, name='Burger', price='2000.00', available=True)

    def public_payload(self, items=None):
        return {
            'business_id': self.negocio.id,
            'customer_name': 'Juan Perez',
            'customer_phone': '1112345678',
            'delivery_address': 'Av. Siempre Viva 123',
            'notes': 'Sin aceitunas',
            'items': items or [
                {'product_id': self.product.id, 'quantity': 2},
                {'product_id': self.second_product.id, 'quantity': 1},
            ],
        }

    def test_public_order_creation(self):
        response = self.client.post(reverse('public_order_create'), self.public_payload(), format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Pedido.objects.count(), 1)
        self.assertEqual(DetallePedido.objects.count(), 2)
        self.assertEqual(response.data['status'], Pedido.STATUS_PENDING)
        self.assertEqual(len(response.data['items']), 2)

    def test_order_total_is_calculated_from_database_prices(self):
        payload = self.public_payload()
        payload['total'] = '1.00'

        response = self.client.post(reverse('public_order_create'), payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        pedido = Pedido.objects.get()
        self.assertEqual(pedido.total, Decimal('2500.00'))
        self.assertEqual(str(response.data['total']), '2500.00')

    def test_rejects_products_from_other_business(self):
        response = self.client.post(
            reverse('public_order_create'),
            self.public_payload(items=[{'product_id': self.other_product.id, 'quantity': 1}]),
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Pedido.objects.count(), 0)

    def test_rejects_unavailable_products(self):
        response = self.client.post(
            reverse('public_order_create'),
            self.public_payload(items=[{'product_id': self.unavailable_product.id, 'quantity': 1}]),
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Pedido.objects.count(), 0)

    def test_rejects_invalid_quantities(self):
        response = self.client.post(
            reverse('public_order_create'),
            self.public_payload(items=[{'product_id': self.product.id, 'quantity': 0}]),
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Pedido.objects.count(), 0)

    def test_private_orders_are_isolated_by_user(self):
        own_order = Pedido.objects.create(negocio=self.negocio, customer_name='Juan', delivery_address='Calle 1', total='1000.00')
        Pedido.objects.create(negocio=self.other_negocio, customer_name='Ana', delivery_address='Calle 2', total='2000.00')
        self.client.force_authenticate(self.user)

        response = self.client.get(reverse('order-list'))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['id'], own_order.id)

    def test_user_can_update_order_status(self):
        pedido = Pedido.objects.create(negocio=self.negocio, customer_name='Juan', delivery_address='Calle 1', total='1000.00')
        self.client.force_authenticate(self.user)

        response = self.client.patch(reverse('order-detail', kwargs={'pk': pedido.pk}), {'status': Pedido.STATUS_ACCEPTED}, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        pedido.refresh_from_db()
        self.assertEqual(pedido.status, Pedido.STATUS_ACCEPTED)

    def test_user_cannot_update_fields_other_than_status(self):
        pedido = Pedido.objects.create(negocio=self.negocio, customer_name='Juan', delivery_address='Calle 1', total='1000.00')
        self.client.force_authenticate(self.user)

        response = self.client.patch(reverse('order-detail', kwargs={'pk': pedido.pk}), {'customer_name': 'Otro'}, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        pedido.refresh_from_db()
        self.assertEqual(pedido.customer_name, 'Juan')

    def test_user_cannot_modify_order_from_other_user(self):
        pedido = Pedido.objects.create(negocio=self.other_negocio, customer_name='Ana', delivery_address='Calle 2', total='2000.00')
        self.client.force_authenticate(self.user)

        response = self.client.patch(reverse('order-detail', kwargs={'pk': pedido.pk}), {'status': Pedido.STATUS_ACCEPTED}, format='json')

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_order_creation_is_atomic(self):
        with patch('pedidos.serializers.DetallePedido.objects.bulk_create', side_effect=RuntimeError('detail failure')):
            with self.assertRaises(RuntimeError):
                self.client.post(reverse('public_order_create'), self.public_payload(), format='json')

        self.assertEqual(Pedido.objects.count(), 0)
        self.assertEqual(DetallePedido.objects.count(), 0)
