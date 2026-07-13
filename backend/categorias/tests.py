from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from negocios.models import Negocio
from .models import Categoria


class CategoriaAPITests(APITestCase):
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
        self.client.force_authenticate(self.user)

    def test_user_can_manage_only_their_categories(self):
        categoria_propia = Categoria.objects.create(
            negocio=self.negocio,
            name='Bebidas',
            description='Refrescos',
            order=1,
            active=True,
        )
        Categoria.objects.create(
            negocio=self.other_negocio,
            name='Postres',
            description='Dulces',
            order=2,
            active=True,
        )

        response = self.client.get(reverse('categoria-list'))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['name'], 'Bebidas')

        create_response = self.client.post(
            reverse('categoria-list'),
            {
                'negocio': self.negocio.id,
                'name': 'Entradas',
                'description': 'Snacks',
                'order': 3,
                'active': True,
            },
            format='json',
        )
        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Categoria.objects.filter(negocio__user=self.user).count(), 2)

        detail_response = self.client.get(reverse('categoria-detail', kwargs={'pk': categoria_propia.pk}))
        self.assertEqual(detail_response.status_code, status.HTTP_200_OK)

        update_response = self.client.patch(
            reverse('categoria-detail', kwargs={'pk': categoria_propia.pk}),
            {'name': 'Bebidas actualizadas'},
            format='json',
        )
        self.assertEqual(update_response.status_code, status.HTTP_200_OK)
        self.assertEqual(update_response.data['name'], 'Bebidas actualizadas')

    def test_user_cannot_access_categories_from_other_users(self):
        categoria_ajena = Categoria.objects.create(
            negocio=self.other_negocio,
            name='Postres',
            description='Dulces',
            order=1,
            active=True,
        )

        response = self.client.get(reverse('categoria-detail', kwargs={'pk': categoria_ajena.pk}))
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

        update_response = self.client.patch(
            reverse('categoria-detail', kwargs={'pk': categoria_ajena.pk}),
            {'name': 'Intento'},
            format='json',
        )
        self.assertEqual(update_response.status_code, status.HTTP_404_NOT_FOUND)

        delete_response = self.client.delete(reverse('categoria-detail', kwargs={'pk': categoria_ajena.pk}))
        self.assertEqual(delete_response.status_code, status.HTTP_404_NOT_FOUND)
