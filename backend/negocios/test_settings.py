from decimal import Decimal
from zoneinfo import ZoneInfo

from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from categorias.models import Categoria
from pedidos.models import Pedido
from productos.models import Producto
from .models import BusinessSchedule, ConfiguracionNegocio, Negocio
from .operations import ensure_business_settings, get_business_open_status


class BusinessSettingsTests(APITestCase):
    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_user(username='owner', email='o@example.com', password='Pass123456')
        self.other = User.objects.create_user(username='other', email='x@example.com', password='Pass123456')
        self.business = Negocio.objects.create(user=self.user, name='Local', phone='549111111', email='l@example.com')
        self.other_business = Negocio.objects.create(user=self.other, name='Otro', phone='1', email='x@example.com')
        self.category = Categoria.objects.create(negocio=self.business, name='Pizzas')
        self.product = Producto.objects.create(negocio=self.business, categoria=self.category, name='Pizza', price='1000.00', available=True)
        self.client.force_authenticate(self.user)

    def payload(self, **kwargs):
        data = {
            'business_id': self.business.id,
            'customer_name': 'Juan',
            'customer_phone': '111',
            'delivery_address': 'Calle 1',
            'fulfillment_type': Pedido.FULFILLMENT_DELIVERY,
            'items': [{'product_id': self.product.id, 'quantity': 1}],
        }
        data.update(kwargs)
        return data

    def test_settings_created_automatically_and_isolated(self):
        response = self.client.get(reverse('business_settings'), {'business_id': self.business.id})
        foreign = self.client.get(reverse('business_settings'), {'business_id': self.other_business.id})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(ConfiguracionNegocio.objects.filter(negocio=self.business).exists())
        self.assertEqual(self.business.schedules.count(), 7)
        self.assertEqual(foreign.status_code, status.HTTP_404_NOT_FOUND)

    def test_ensure_business_settings_is_idempotent_and_only_creates_missing_schedules(self):
        BusinessSchedule.objects.create(
            negocio=self.business,
            weekday=0,
            is_closed=False,
            opening_time='09:00',
            closing_time='18:00',
        )

        ensure_business_settings(self.business)
        ensure_business_settings(self.business)

        schedules = BusinessSchedule.objects.filter(negocio=self.business)
        monday = schedules.get(weekday=0)

        self.assertEqual(schedules.count(), 7)
        self.assertEqual(schedules.values('weekday').distinct().count(), 7)
        self.assertEqual(monday.opening_time.strftime('%H:%M'), '09:00')
        self.assertEqual(monday.closing_time.strftime('%H:%M'), '18:00')

    def test_valid_and_invalid_schedules(self):
        valid = [{'weekday': 0, 'is_closed': False, 'opening_time': '09:00', 'closing_time': '18:00'}]
        invalid = [{'weekday': 1, 'is_closed': False, 'opening_time': '18:00', 'closing_time': '09:00'}]

        self.assertEqual(self.client.put(f"{reverse('business_schedules')}?business_id={self.business.id}", valid, format='json').status_code, status.HTTP_200_OK)
        response = self.client.put(f"{reverse('business_schedules')}?business_id={self.business.id}", invalid, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_open_closed_and_next_opening(self):
        BusinessSchedule.objects.update_or_create(negocio=self.business, weekday=0, defaults={'is_closed': False, 'opening_time': '09:00', 'closing_time': '18:00'})
        tz = ZoneInfo('America/Argentina/Buenos_Aires')
        open_dt = timezone.datetime(2026, 7, 20, 10, 0, tzinfo=tz)
        closed_dt = timezone.datetime(2026, 7, 20, 20, 0, tzinfo=tz)

        self.assertTrue(get_business_open_status(self.business, open_dt)['is_open'])
        closed = get_business_open_status(self.business, closed_dt)
        self.assertFalse(closed['is_open'])
        self.assertIsNotNone(closed['next_opening'])

    def test_order_disabled_closed_and_accept_closed(self):
        settings = ConfiguracionNegocio.objects.create(negocio=self.business, orders_enabled=False)
        response = self.client.post(reverse('public_order_create'), self.payload(), format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        settings.orders_enabled = True
        settings.accept_orders_when_closed = True
        settings.save()
        response = self.client.post(reverse('public_order_create'), self.payload(), format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_delivery_pickup_minimum_fee_free_and_required_fields(self):
        settings = ConfiguracionNegocio.objects.create(
            negocio=self.business,
            minimum_order='500.00',
            delivery_fee='100.00',
            free_delivery_from='1000.00',
            require_customer_phone=True,
            require_delivery_address=True,
            accept_orders_when_closed=True,
            estimated_delivery_minutes=45,
        )
        missing_phone = self.client.post(reverse('public_order_create'), self.payload(customer_phone=''), format='json')
        self.assertEqual(missing_phone.status_code, status.HTTP_400_BAD_REQUEST)
        order = self.client.post(reverse('public_order_create'), self.payload(), format='json')
        self.assertEqual(order.status_code, status.HTTP_201_CREATED)
        pedido = Pedido.objects.get(pk=order.data['id'])
        self.assertEqual(pedido.delivery_fee, Decimal('0.00'))
        self.assertEqual(pedido.estimated_minutes, 45)

        settings.delivery_enabled = False
        settings.save()
        blocked = self.client.post(reverse('public_order_create'), self.payload(), format='json')
        self.assertEqual(blocked.status_code, status.HTTP_400_BAD_REQUEST)

        settings.delivery_enabled = True
        settings.pickup_enabled = False
        settings.save()
        pickup = self.client.post(reverse('public_order_create'), self.payload(fulfillment_type=Pedido.FULFILLMENT_PICKUP, delivery_address=''), format='json')
        self.assertEqual(pickup.status_code, status.HTTP_400_BAD_REQUEST)
