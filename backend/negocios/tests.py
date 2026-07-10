from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

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
            'phone': '789012',
            'email': 'segundo@example.com',
            'address': 'Avenida Siempre Viva 742',
            'active': True,
        }
        create_response = self.client.post(reverse('negocio-list'), payload, format='json')
        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Negocio.objects.filter(user=self.user).count(), 2)

    def test_user_cannot_access_or_modify_other_users_business(self):
        negocio = Negocio.objects.create(user=self.other_user, name='Negocio ajeno', phone='111', email='a@example.com', address='Calle X')

        detail_response = self.client.get(reverse('negocio-detail', kwargs={'pk': negocio.pk}))
        self.assertEqual(detail_response.status_code, status.HTTP_404_NOT_FOUND)

        update_response = self.client.patch(reverse('negocio-detail', kwargs={'pk': negocio.pk}), {'name': 'Intento'}, format='json')
        self.assertEqual(update_response.status_code, status.HTTP_404_NOT_FOUND)

        delete_response = self.client.delete(reverse('negocio-detail', kwargs={'pk': negocio.pk}))
        self.assertEqual(delete_response.status_code, status.HTTP_404_NOT_FOUND)
