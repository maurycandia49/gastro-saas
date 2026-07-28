from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.db import OperationalError
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from categorias.models import Categoria
from inventory.models import Ingredient
from negocios.models import ConfiguracionNegocio, Negocio
from pedidos.models import Pedido
from productos.models import Producto
from recetas.models import RecipeIngredient
from .engine import OpportunityGenerationBusy, calculate_business_health_score, generate_business_opportunities
from .models import BusinessOpportunity


class OpportunitiesTests(APITestCase):
    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_user(username='owner', email='o@example.com', password='Pass123456')
        self.other = User.objects.create_user(username='other', email='x@example.com', password='Pass123456')
        self.business = Negocio.objects.create(user=self.user, name='Local', email='l@example.com')
        ConfiguracionNegocio.objects.create(negocio=self.business, low_margin_threshold=Decimal('30.00'), dead_product_days=14, inactive_customer_days=21)
        self.category = Categoria.objects.create(negocio=self.business, name='Pizzas')
        self.product = Producto.objects.create(negocio=self.business, categoria=self.category, name='Napolitana', price=Decimal('100.00'), available=True)
        self.ingredient = Ingredient.objects.create(negocio=self.business, name='Mozzarella', unit='kg', current_stock=Decimal('1.000'), minimum_stock=Decimal('2.000'), purchase_price=Decimal('3000.00'))
        RecipeIngredient.objects.create(producto=self.product, ingredient=self.ingredient, quantity=Decimal('1.000'), unit='kg', waste_percentage=Decimal('0.00'))
        self.client.force_authenticate(self.user)

    def test_generation_is_idempotent_and_uses_fingerprint(self):
        generate_business_opportunities(self.business)
        generate_business_opportunities(self.business)

        self.assertEqual(BusinessOpportunity.objects.filter(negocio=self.business, opportunity_type='low_stock').count(), 1)
        self.assertIn(f'ingredient_{self.ingredient.id}', BusinessOpportunity.objects.get(opportunity_type='low_stock').fingerprint)

    def test_opportunity_fingerprint_is_unique_per_business(self):
        generate_business_opportunities(self.business)

        constraints = BusinessOpportunity._meta.constraints
        self.assertTrue(any(constraint.name == 'unique_business_opportunity_fingerprint' for constraint in constraints))

    def test_resolves_when_rule_stops_applying(self):
        generate_business_opportunities(self.business)
        self.ingredient.current_stock = Decimal('5.000')
        self.ingredient.save()
        generate_business_opportunities(self.business)

        opportunity = BusinessOpportunity.objects.get(opportunity_type='low_stock')
        self.assertFalse(opportunity.active)
        self.assertIsNotNone(opportunity.resolved_at)

    def test_profitability_rules_and_health_score(self):
        generate_business_opportunities(self.business)
        health = calculate_business_health_score(self.business)

        self.assertTrue(BusinessOpportunity.objects.filter(opportunity_type='negative_profit', active=True).exists())
        self.assertLess(health['score'], 100)
        self.assertTrue(health['actions'])

    def test_dead_product_and_pending_orders(self):
        Pedido.objects.create(negocio=self.business, customer_name='Juan', delivery_address='Calle', status=Pedido.STATUS_PENDING, total=Decimal('0.00'), estimated_minutes=1)

        generate_business_opportunities(self.business, timezone.now() + timezone.timedelta(minutes=5))

        self.assertTrue(BusinessOpportunity.objects.filter(opportunity_type='dead_product', active=True).exists())
        self.assertTrue(BusinessOpportunity.objects.filter(opportunity_type='preparation_delay', active=True).exists())

    def test_endpoints_isolation_patch_and_summary(self):
        generate_business_opportunities(self.business)
        opportunity = BusinessOpportunity.objects.filter(negocio=self.business).first()
        other_business = Negocio.objects.create(user=self.other, name='Otro', email='x@example.com')

        list_response = self.client.get(reverse('opportunities'), {'business_id': self.business.id})
        summary_response = self.client.get(reverse('opportunities_summary'), {'business_id': self.business.id})
        health_response = self.client.get(reverse('business_health'), {'business_id': self.business.id})
        patch_response = self.client.patch(reverse('opportunity_detail', args=[opportunity.id]), {'read': True, 'dismissed': True}, format='json')
        foreign_response = self.client.get(reverse('opportunities'), {'business_id': other_business.id})

        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(summary_response.status_code, status.HTTP_200_OK)
        self.assertEqual(health_response.status_code, status.HTTP_200_OK)
        self.assertEqual(patch_response.status_code, status.HTTP_200_OK)
        self.assertTrue(patch_response.data['read'])
        self.assertEqual(foreign_response.status_code, status.HTTP_404_NOT_FOUND)

    def test_generate_endpoint_is_idempotent_on_consecutive_calls(self):
        url = f'{reverse("opportunities_generate")}?business_id={self.business.id}'
        first = self.client.post(url)
        second = self.client.post(url)

        self.assertEqual(first.status_code, status.HTTP_200_OK)
        self.assertEqual(second.status_code, status.HTTP_200_OK)
        self.assertEqual(BusinessOpportunity.objects.filter(negocio=self.business, opportunity_type='low_stock').count(), 1)

    def test_generate_endpoint_returns_friendly_response_when_database_remains_locked(self):
        with patch('opportunities.views.generate_business_opportunities', side_effect=OpportunityGenerationBusy('La base de datos esta ocupada generando oportunidades. Intenta nuevamente en unos segundos.')):
            response = self.client.post(f'{reverse("opportunities_generate")}?business_id={self.business.id}')

        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertIn('ocupada', response.data['detail'])

    def test_engine_retries_short_controlled_database_locks(self):
        calls = {'count': 0}

        def flaky_persist(*args, **kwargs):
            calls['count'] += 1
            if calls['count'] < 2:
                raise OperationalError('database is locked')
            return BusinessOpportunity.objects.none()

        with patch('opportunities.engine._persist_opportunity_specs', side_effect=flaky_persist), patch('opportunities.engine.time.sleep'):
            generate_business_opportunities(self.business)

        self.assertEqual(calls['count'], 2)

    def test_score_max_without_problems(self):
        clean_business = Negocio.objects.create(user=self.user, name='Limpio', email='clean@example.com')
        ConfiguracionNegocio.objects.create(negocio=clean_business, whatsapp_number='549111111')

        health = calculate_business_health_score(clean_business)

        self.assertEqual(health['score'], 100)
