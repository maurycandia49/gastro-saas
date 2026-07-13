from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from categorias.models import Categoria
from negocios.models import Negocio
from .models import Producto


class ProductoAPITests(APITestCase):
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
        self.negocio = Negocio.objects.create(
            user=self.user,
            name='Mi negocio',
            phone='123456',
            email='mi@example.com',
            address='Calle 123',
        )
        self.other_negocio = Negocio.objects.create(
            user=self.other_user,
            name='Negocio ajeno',
            phone='999999',
            email='otro@example.com',
            address='Otra calle',
        )
        self.categoria = Categoria.objects.create(
            negocio=self.negocio,
            name='Pizzas',
            description='Pizzas clásicas',
            order=1,
            active=True,
        )
        self.other_categoria = Categoria.objects.create(
            negocio=self.other_negocio,
            name='Hamburguesas',
            description='Hamburguesas',
            order=1,
            active=True,
        )
        self.client.force_authenticate(self.user)

    def test_user_can_manage_only_their_products(self):
        producto = Producto.objects.create(
            negocio=self.negocio,
            categoria=self.categoria,
            name='Pizza Margarita',
            description='Clásica',
            price='10.50',
            available=True,
            featured=False,
            order=1,
        )
        Producto.objects.create(
            negocio=self.other_negocio,
            categoria=self.other_categoria,
            name='Burger',
            description='Doble',
            price='8.00',
            available=True,
            featured=False,
            order=2,
        )

        response = self.client.get(reverse('producto-list'))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['name'], 'Pizza Margarita')

        create_response = self.client.post(
            reverse('producto-list'),
            {
                'negocio': self.negocio.id,
                'categoria': self.categoria.id,
                'name': 'Pizza Pepperoni',
                'description': 'Con pepperoni',
                'price': '12.50',
                'available': True,
                'featured': True,
                'order': 2,
            },
            format='json',
        )
        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Producto.objects.filter(negocio__user=self.user).count(), 2)

        detail_response = self.client.get(reverse('producto-detail', kwargs={'pk': producto.pk}))
        self.assertEqual(detail_response.status_code, status.HTTP_200_OK)

        update_response = self.client.patch(
            reverse('producto-detail', kwargs={'pk': producto.pk}),
            {'name': 'Pizza Margarita Actualizada'},
            format='json',
        )
        self.assertEqual(update_response.status_code, status.HTTP_200_OK)
        self.assertEqual(update_response.data['name'], 'Pizza Margarita Actualizada')

    def test_user_cannot_access_products_from_other_users(self):
        producto_ajeno = Producto.objects.create(
            negocio=self.other_negocio,
            categoria=self.other_categoria,
            name='Burger',
            description='Doble',
            price='8.00',
            available=True,
            featured=False,
            order=1,
        )

        response = self.client.get(reverse('producto-detail', kwargs={'pk': producto_ajeno.pk}))
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

        update_response = self.client.patch(
            reverse('producto-detail', kwargs={'pk': producto_ajeno.pk}),
            {'name': 'Intento'},
            format='json',
        )
        self.assertEqual(update_response.status_code, status.HTTP_404_NOT_FOUND)

        delete_response = self.client.delete(reverse('producto-detail', kwargs={'pk': producto_ajeno.pk}))
        self.assertEqual(delete_response.status_code, status.HTTP_404_NOT_FOUND)
