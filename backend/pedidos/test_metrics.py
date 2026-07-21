from datetime import timedelta
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


class MetricsAPITests(APITestCase):
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

    def create_order(self, total, status_value=Pedido.STATUS_DELIVERED, created_at=None, items=None, negocio=None):
        order = Pedido.objects.create(
            negocio=negocio or self.negocio,
            customer_name='Cliente',
            delivery_address='Calle 123',
            status=status_value,
            total=total,
        )
        if created_at:
            Pedido.objects.filter(pk=order.pk).update(created_at=created_at)
            order.refresh_from_db()

        for item in items or [(self.product, 1, Decimal('1000.00'), Decimal('400.00'))]:
            product, quantity, unit_price = item[:3]
            unit_cost = item[3] if len(item) > 3 else Decimal('0.00')
            DetallePedido.objects.create(
                pedido=order,
                producto=product,
                product_name=product.name,
                unit_price=unit_price,
                unit_cost=unit_cost,
                quantity=quantity,
                subtotal=unit_price * quantity,
                subtotal_cost=unit_cost * quantity,
                profit=(unit_price - unit_cost) * quantity,
            )
        return order

    def summary(self, business_id=None):
        return self.client.get(reverse('metrics_summary'), {'business_id': business_id or self.negocio.id, 'period': 'today'})

    def test_sales_total_excludes_cancelled_orders(self):
        self.create_order('1000.00')
        self.create_order('5000.00', status_value=Pedido.STATUS_CANCELLED)

        response = self.summary()

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(Decimal(response.data['sales_total']), Decimal('1000.00'))

    def test_orders_count_and_average_ticket(self):
        self.create_order('1000.00')
        self.create_order('3000.00')

        response = self.summary()

        self.assertEqual(response.data['orders_count'], 2)
        self.assertEqual(Decimal(response.data['average_ticket']), Decimal('2000.00'))

    def test_top_product_and_items_sold(self):
        self.create_order('2500.00', items=[
            (self.product, 2, Decimal('1000.00'), Decimal('400.00')),
            (self.second_product, 1, Decimal('500.00'), Decimal('200.00')),
        ])

        response = self.summary()

        self.assertEqual(response.data['items_sold'], 3)
        self.assertEqual(response.data['top_product']['product_id'], self.product.id)
        self.assertEqual(response.data['top_product']['quantity'], 2)
        self.assertEqual(Decimal(response.data['top_product']['revenue']), Decimal('2000.00'))

    def test_orders_by_status(self):
        self.create_order('1000.00', status_value=Pedido.STATUS_PENDING)
        self.create_order('1000.00', status_value=Pedido.STATUS_READY)
        self.create_order('1000.00', status_value=Pedido.STATUS_CANCELLED)

        response = self.summary()

        self.assertEqual(response.data['orders_by_status']['pendiente'], 1)
        self.assertEqual(response.data['orders_by_status']['listo'], 1)
        self.assertEqual(response.data['orders_by_status']['cancelado'], 1)

    def test_hourly_sales(self):
        current_timezone = timezone.get_current_timezone()
        now = timezone.localtime(timezone.now(), current_timezone)
        target = now.replace(hour=10, minute=15, second=0, microsecond=0)
        self.create_order('1500.00', created_at=target)

        response = self.client.get(reverse('metrics_hourly_sales'), {'business_id': self.negocio.id, 'date': target.date().isoformat()})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 24)
        self.assertEqual(Decimal(response.data[10]['sales_total']), Decimal('1500.00'))
        self.assertEqual(response.data[10]['orders_count'], 1)

    def test_previous_period_comparison(self):
        yesterday = timezone.now() - timedelta(days=1)
        self.create_order('2000.00')
        self.create_order('1000.00', created_at=yesterday)

        response = self.summary()

        self.assertEqual(Decimal(response.data['previous_period']['sales_total']), Decimal('1000.00'))
        self.assertEqual(response.data['previous_period']['orders_count'], 1)
        self.assertEqual(Decimal(response.data['sales_change_percentage']), Decimal('100.00'))

    def test_metrics_are_isolated_between_users(self):
        self.create_order('1000.00')
        self.create_order('9000.00', negocio=self.other_negocio)

        response = self.summary()

        self.assertEqual(Decimal(response.data['sales_total']), Decimal('1000.00'))

    def test_rejects_missing_or_foreign_business(self):
        missing = self.client.get(reverse('metrics_summary'))
        foreign = self.summary(self.other_negocio.id)

        self.assertEqual(missing.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(foreign.status_code, status.HTTP_404_NOT_FOUND)

    def test_day_without_orders_returns_zeroes(self):
        response = self.summary()

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(Decimal(response.data['sales_total']), Decimal('0.00'))
        self.assertEqual(response.data['orders_count'], 0)
        self.assertEqual(Decimal(response.data['average_ticket']), Decimal('0.00'))
        self.assertEqual(response.data['items_sold'], 0)
        self.assertIsNone(response.data['top_product'])

    def test_profit_metrics_calculate_profit_and_margin(self):
        self.create_order('2500.00', items=[
            (self.product, 2, Decimal('1000.00'), Decimal('400.00')),
            (self.second_product, 1, Decimal('500.00'), Decimal('300.00')),
        ])

        response = self.client.get(reverse('metrics_profit'), {'business_id': self.negocio.id, 'period': 'today'})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(Decimal(response.data['sales']), Decimal('2500.00'))
        self.assertEqual(Decimal(response.data['costs']), Decimal('1100.00'))
        self.assertEqual(Decimal(response.data['gross_profit']), Decimal('1400.00'))
        self.assertEqual(Decimal(response.data['profit_margin']), Decimal('56.00'))

    def test_profit_metrics_use_historical_cost(self):
        self.product.cost_price = Decimal('400.00')
        self.product.save(update_fields=['cost_price'])
        payload = {
            'business_id': self.negocio.id,
            'customer_name': 'Juan',
            'delivery_address': 'Calle 123',
            'items': [{'product_id': self.product.id, 'quantity': 1}],
        }
        response = self.client.post(reverse('public_order_create'), payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        self.product.cost_price = Decimal('900.00')
        self.product.save(update_fields=['cost_price'])
        detail = DetallePedido.objects.get()

        self.assertEqual(detail.unit_cost, Decimal('400.00'))
        self.assertEqual(detail.profit, Decimal('600.00'))

    def test_profit_metrics_top_and_least_profitable_products(self):
        self.create_order('3000.00', items=[
            (self.product, 2, Decimal('1000.00'), Decimal('200.00')),
            (self.second_product, 2, Decimal('500.00'), Decimal('450.00')),
        ])

        response = self.client.get(reverse('metrics_profit'), {'business_id': self.negocio.id})

        self.assertEqual(response.data['top_profitable_product']['product_id'], self.product.id)
        self.assertEqual(response.data['least_profitable_product']['product_id'], self.second_product.id)

    def test_profit_metrics_exclude_cancelled_orders(self):
        self.create_order('1000.00', items=[(self.product, 1, Decimal('1000.00'), Decimal('400.00'))])
        self.create_order('5000.00', status_value=Pedido.STATUS_CANCELLED, items=[(self.product, 5, Decimal('1000.00'), Decimal('100.00'))])

        response = self.client.get(reverse('metrics_profit'), {'business_id': self.negocio.id})

        self.assertEqual(Decimal(response.data['sales']), Decimal('1000.00'))
        self.assertEqual(Decimal(response.data['gross_profit']), Decimal('600.00'))

    def test_profit_metrics_ignore_products_without_cost_for_product_margin_cards(self):
        self.create_order('1000.00', items=[(self.product, 1, Decimal('1000.00'), Decimal('0.00'))])

        response = self.client.get(reverse('metrics_profit'), {'business_id': self.negocio.id})

        self.assertEqual(Decimal(response.data['sales']), Decimal('1000.00'))
        self.assertEqual(Decimal(response.data['costs']), Decimal('0.00'))
        self.assertIsNone(response.data['top_profitable_product'])
        self.assertIsNone(response.data['least_profitable_product'])
