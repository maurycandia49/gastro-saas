from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from categorias.models import Categoria
from productos.models import Producto
from .models import Negocio


class NegocioAPITests(APITestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            username='owner',
            email='owner@example.com',
            password='SecurePass123',
        )
        self.other_user = get_user_model().objects.create_user(
            username='other',
            email='other@example.com',
            password='SecurePass123',
        )
        self.client.force_authenticate(self.user)

    def test_user_can_list_and_create_only_their_businesses(self):
        Negocio.objects.create(user=self.user, name='Mi negocio', phone='123456', email='mi@example.com', address='Calle 123')
        Negocio.objects.create(user=self.other_user, name='Negocio ajeno', phone='999999', email='otro@example.com', address='Otra calle')

        response = self.client.get(reverse('negocio-list'))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['name'], 'Mi negocio')

        payload = {
            'name': 'Segundo negocio',
            'description': 'Comida casera todos los dias',
            'phone': '789012',
            'email': 'segundo@example.com',
            'address': 'Avenida Siempre Viva 742',
            'primary_color': '#2563eb',
            'opening_hours': 'Lunes a viernes de 9 a 18',
            'instagram': 'https://instagram.com/segundo',
            'facebook': 'https://facebook.com/segundo',
            'active': True,
        }
        create_response = self.client.post(reverse('negocio-list'), payload, format='json')
        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(create_response.data['description'], payload['description'])
        self.assertEqual(create_response.data['primary_color'], payload['primary_color'])
        self.assertEqual(create_response.data['opening_hours'], payload['opening_hours'])
        self.assertEqual(create_response.data['instagram'], payload['instagram'])
        self.assertEqual(create_response.data['facebook'], payload['facebook'])
        self.assertEqual(Negocio.objects.filter(user=self.user).count(), 2)

    def test_user_can_update_business_customization_fields(self):
        negocio = Negocio.objects.create(user=self.user, name='Mi negocio', phone='123456', email='mi@example.com', address='Calle 123')

        payload = {
            'description': 'Menu artesanal',
            'primary_color': '#16a34a',
            'opening_hours': 'Todos los dias de 12 a 23',
            'instagram': 'https://instagram.com/minegocio',
            'facebook': 'https://facebook.com/minegocio',
        }
        response = self.client.patch(reverse('negocio-detail', kwargs={'pk': negocio.pk}), payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        negocio.refresh_from_db()
        self.assertEqual(negocio.description, payload['description'])
        self.assertEqual(negocio.primary_color, payload['primary_color'])
        self.assertEqual(negocio.opening_hours, payload['opening_hours'])
        self.assertEqual(negocio.instagram, payload['instagram'])
        self.assertEqual(negocio.facebook, payload['facebook'])

    def test_user_cannot_access_or_modify_other_users_business(self):
        negocio = Negocio.objects.create(user=self.other_user, name='Negocio ajeno', phone='111', email='a@example.com', address='Calle X')

        detail_response = self.client.get(reverse('negocio-detail', kwargs={'pk': negocio.pk}))
        self.assertEqual(detail_response.status_code, status.HTTP_404_NOT_FOUND)

        update_response = self.client.patch(reverse('negocio-detail', kwargs={'pk': negocio.pk}), {'name': 'Intento'}, format='json')
        self.assertEqual(update_response.status_code, status.HTTP_404_NOT_FOUND)

        delete_response = self.client.delete(reverse('negocio-detail', kwargs={'pk': negocio.pk}))
        self.assertEqual(delete_response.status_code, status.HTTP_404_NOT_FOUND)

    def test_public_menu_includes_business_customization_fields(self):
        negocio = Negocio.objects.create(
            user=self.user,
            name='Menu publico',
            description='Pastas y pizzas',
            phone='123',
            email='menu@example.com',
            address='Calle Menu 123',
            primary_color='#dc2626',
            opening_hours='Martes a domingo de 19 a 23',
            instagram='https://instagram.com/menu',
            facebook='https://facebook.com/menu',
        )
        self.client.force_authenticate(user=None)

        response = self.client.get(reverse('public_menu', kwargs={'business_id': negocio.pk}))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['description'], negocio.description)
        self.assertEqual(response.data['email'], negocio.email)
        self.assertEqual(response.data['primary_color'], negocio.primary_color)
        self.assertEqual(response.data['opening_hours'], negocio.opening_hours)
        self.assertEqual(response.data['instagram'], negocio.instagram)
        self.assertEqual(response.data['facebook'], negocio.facebook)

    def test_public_menu_includes_unavailable_products_with_available_flag(self):
        negocio = Negocio.objects.create(user=self.user, name='Menu con agotados', phone='123', email='agotados@example.com')
        categoria = Categoria.objects.create(negocio=negocio, name='Pizzas', active=True)
        Producto.objects.create(negocio=negocio, categoria=categoria, name='Pizza disponible', price='1000.00', available=True)
        Producto.objects.create(negocio=negocio, categoria=categoria, name='Pizza agotada', price='1200.00', available=False)
        self.client.force_authenticate(user=None)

        response = self.client.get(reverse('public_menu', kwargs={'business_id': negocio.pk}))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        products = response.data['categorias'][0]['productos']
        self.assertEqual(len(products), 2)
        self.assertEqual({product['name']: product['available'] for product in products}, {
            'Pizza disponible': True,
            'Pizza agotada': False,
        })
