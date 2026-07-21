from decimal import Decimal

from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from categorias.models import Categoria
from negocios.models import Negocio
from pedidos.models import DetallePedido, Pedido
from productos.models import Producto
from .models import Promocion
from .pricing import get_effective_price


class PromocionAPITests(APITestCase):
    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_user(username='owner', email='owner@example.com', password='Pass123456')
        self.other_user = User.objects.create_user(username='other', email='other@example.com', password='Pass123456')
        self.negocio = Negocio.objects.create(user=self.user, name='Pizzeria', phone='123', email='pizza@example.com')
        self.other_negocio = Negocio.objects.create(user=self.other_user, name='Otro', phone='999', email='otro@example.com')
        self.categoria = Categoria.objects.create(negocio=self.negocio, name='Pizzas')
        self.other_categoria = Categoria.objects.create(negocio=self.other_negocio, name='Otros')
        self.product = Producto.objects.create(negocio=self.negocio, categoria=self.categoria, name='Muzza', price='1000.00', cost_price='400.00')
        self.other_product = Producto.objects.create(negocio=self.other_negocio, categoria=self.other_categoria, name='Ajeno', price='1000.00')
        self.now = timezone.now()
        self.client.force_authenticate(self.user)

    def payload(self, **overrides):
        data = {
            'negocio': self.negocio.id,
            'name': 'Promo',
            'description': '',
            'promotion_type': Promocion.TYPE_PERCENTAGE,
            'percentage_discount': '20.00',
            'fixed_price': None,
            'producto': self.product.id,
            'categoria': None,
            'starts_at': (self.now - timezone.timedelta(hours=1)).isoformat(),
            'ends_at': (self.now + timezone.timedelta(days=1)).isoformat(),
            'active': True,
            'featured': False,
        }
        data.update(overrides)
        return data

    def create_promo(self, **overrides):
        data = self.payload(**overrides)
        return Promocion.objects.create(
            negocio=self.negocio,
            name=data['name'],
            description=data.get('description', ''),
            promotion_type=data['promotion_type'],
            percentage_discount=data.get('percentage_discount'),
            fixed_price=data.get('fixed_price'),
            producto=self.product if data.get('producto') else None,
            categoria=self.categoria if data.get('categoria') else None,
            starts_at=self.now - timezone.timedelta(hours=1),
            ends_at=self.now + timezone.timedelta(days=1),
            active=data.get('active', True),
            featured=data.get('featured', False),
        )

    def test_valid_percentage_and_fixed_price_promotions(self):
        percentage = self.client.post(reverse('promotion-list'), self.payload(), format='json')
        fixed = self.client.post(reverse('promotion-list'), self.payload(
            name='Fijo',
            promotion_type=Promocion.TYPE_FIXED_PRICE,
            percentage_discount=None,
            fixed_price='700.00',
        ), format='json')

        self.assertEqual(percentage.status_code, status.HTTP_201_CREATED)
        self.assertEqual(fixed.status_code, status.HTTP_201_CREATED)

    def test_invalid_dates_product_and_category_together_and_without_target(self):
        invalid_dates = self.client.post(reverse('promotion-list'), self.payload(
            starts_at=(self.now + timezone.timedelta(days=1)).isoformat(),
            ends_at=self.now.isoformat(),
        ), format='json')
        both = self.client.post(reverse('promotion-list'), self.payload(categoria=self.categoria.id), format='json')
        none = self.client.post(reverse('promotion-list'), self.payload(producto=None), format='json')

        self.assertEqual(invalid_dates.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(both.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(none.status_code, status.HTTP_400_BAD_REQUEST)

    def test_rejects_product_or_category_from_other_business(self):
        product_response = self.client.post(reverse('promotion-list'), self.payload(producto=self.other_product.id), format='json')
        category_response = self.client.post(reverse('promotion-list'), self.payload(producto=None, categoria=self.other_categoria.id), format='json')

        self.assertEqual(product_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(category_response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_isolation_between_users(self):
        Promocion.objects.create(
            negocio=self.other_negocio,
            name='Ajena',
            promotion_type=Promocion.TYPE_PERCENTAGE,
            percentage_discount='10.00',
            producto=self.other_product,
            starts_at=self.now,
            ends_at=self.now + timezone.timedelta(days=1),
        )

        response = self.client.get(reverse('promotion-list'))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, [])

    def test_active_future_expired_and_inactive_promotions(self):
        active = self.create_promo()
        self.assertEqual(get_effective_price(self.product)['promotion_id'], active.id)
        active.starts_at = self.now + timezone.timedelta(days=1)
        active.ends_at = self.now + timezone.timedelta(days=2)
        active.save()
        self.assertIsNone(get_effective_price(self.product)['promotion_id'])
        active.starts_at = self.now - timezone.timedelta(days=2)
        active.ends_at = self.now - timezone.timedelta(days=1)
        active.save()
        self.assertIsNone(get_effective_price(self.product)['promotion_id'])
        active.ends_at = self.now + timezone.timedelta(days=1)
        active.active = False
        active.save()
        self.assertIsNone(get_effective_price(self.product)['promotion_id'])

    def test_multiple_promotions_choose_lowest_price(self):
        self.create_promo(percentage_discount='10.00')
        fixed = self.create_promo(name='Mas barata', promotion_type=Promocion.TYPE_FIXED_PRICE, percentage_discount=None, fixed_price='500.00')

        info = get_effective_price(self.product)

        self.assertEqual(info['promotion_id'], fixed.id)
        self.assertEqual(info['final_price'], Decimal('500.00'))

    def test_order_uses_promotion_and_preserves_historical_cost(self):
        self.create_promo(percentage_discount='25.00')
        payload = {
            'business_id': self.negocio.id,
            'customer_name': 'Juan',
            'delivery_address': 'Calle 1',
            'items': [{'product_id': self.product.id, 'quantity': 2}],
        }

        response = self.client.post(reverse('public_order_create'), payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        detail = DetallePedido.objects.get()
        self.assertEqual(detail.original_unit_price, Decimal('1000.00'))
        self.assertEqual(detail.unit_price, Decimal('750.00'))
        self.assertEqual(detail.unit_cost, Decimal('400.00'))
        self.assertEqual(detail.discount_amount, Decimal('250.00'))
        self.assertEqual(Pedido.objects.get().total, Decimal('1500.00'))

    def test_order_confirmed_after_promotion_expires_uses_current_price(self):
        promo = self.create_promo(percentage_discount='50.00')
        promo.ends_at = self.now - timezone.timedelta(minutes=1)
        promo.save()
        payload = {
            'business_id': self.negocio.id,
            'customer_name': 'Juan',
            'delivery_address': 'Calle 1',
            'items': [{'product_id': self.product.id, 'quantity': 1}],
        }

        response = self.client.post(reverse('public_order_create'), payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(DetallePedido.objects.get().unit_price, Decimal('1000.00'))

    def test_public_menu_exposes_promotional_price(self):
        self.create_promo(percentage_discount='20.00')

        response = self.client.get(reverse('public_menu', kwargs={'business_id': self.negocio.id}))

        product = response.data['categorias'][0]['productos'][0]
        self.assertTrue(product['has_promotion'])
        self.assertEqual(Decimal(product['final_price']), Decimal('800.00'))
        self.assertEqual(Decimal(product['original_price']), Decimal('1000.00'))

    def test_cancelled_orders_still_do_not_affect_metrics(self):
        Pedido.objects.create(negocio=self.negocio, customer_name='A', delivery_address='X', status=Pedido.STATUS_CANCELLED, total='1000.00')

        response = self.client.get(reverse('metrics_summary'), {'business_id': self.negocio.id})

        self.assertEqual(response.data['orders_count'], 0)
