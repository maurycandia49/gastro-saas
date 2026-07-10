from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase


class AuthenticationTests(APITestCase):
    def test_register_login_refresh_logout_flow(self):
        register_url = reverse('auth_register')
        login_url = reverse('token_obtain_pair')
        refresh_url = reverse('token_refresh')
        logout_url = reverse('auth_logout')

        user_data = {
            'username': 'testuser',
            'email': 'test@example.com',
            'password': 'SecurePass123',
            'first_name': 'Test',
            'last_name': 'User',
        }

        response = self.client.post(register_url, user_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        response = self.client.post(login_url, {'username': 'testuser', 'password': 'SecurePass123'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)

        refresh_token = response.data['refresh']
        response = self.client.post(refresh_url, {'refresh': refresh_token}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)

        access_token = response.data['access']
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        response = self.client.post(logout_url, {'refresh': refresh_token}, format='json')
        self.assertEqual(response.status_code, status.HTTP_205_RESET_CONTENT)
