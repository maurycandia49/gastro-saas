from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.urls import reverse
from pathlib import Path
from rest_framework.test import APIClient
from unittest.mock import patch
from types import SimpleNamespace
import json
import sys
import requests

from inventory.models import Ingredient, InventoryMovement
from negocios.models import Negocio
from purchases.models import Supplier
from .matcher import match_line_to_ingredient
from .models import IngredientAlias
from .parser import parse_invoice_text
from .providers.base import OCRBox, OCRDocument, OCRLine, OCRPage, OCRWord, prepare_image
from .services import OCREngineNotAvailable, OCRInvalidImage, extract_document, get_ocr_status


class OCRTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(username='ocr', password='pass12345')
        self.business = Negocio.objects.create(user=self.user, name='Pizzeria OCR')
        self.supplier = Supplier.objects.create(negocio=self.business, name='Distribuidora Sur', tax_id='20-12345678-9')
        self.ingredient = Ingredient.objects.create(negocio=self.business, name='Mozzarella Barraza', unit='kg', purchase_price=0)
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def _ocr_line_from_cells(self, top, cells):
        words = []
        for text, left in cells:
            words.append(OCRWord(text=text, confidence=96, box=OCRBox(left, top, max(18, len(text) * 7), 14)))
        right = max(word.box.left + word.box.width for word in words)
        left = min(word.box.left for word in words)
        return OCRLine(text=' '.join(word.text for word in words), confidence=96, box=OCRBox(left, top, right - left, 14), words=words)

    def test_parser_detects_invoice_fields_and_items(self):
        parsed = parse_invoice_text('Distribuidora Sur\nCUIT 20-12345678-9\nFactura A-0001-00001234\nFecha 26/07/2026\nMUZZ BARR 10 kg 10500 105000\nTOTAL $105000')
        self.assertEqual(parsed['supplier']['name'], 'Distribuidora Sur')
        self.assertEqual(parsed['date'], '2026-07-26')
        self.assertEqual(parsed['items'][0]['quantity'], '10')
        self.assertEqual(parsed['items'][0]['unit'], 'kg')

    def test_parser_detects_ocr_lines_without_unit(self):
        parsed = parse_invoice_text('Proveedor Demo\nDescripcion Cant P.Unit Importe\nACEITE NATURA 2 1200 2400\nHARINA 000 5 900 4500\nTOTAL $6900')
        self.assertEqual(len(parsed['items']), 2)
        self.assertEqual(parsed['items'][0]['detected_text'], 'ACEITE NATURA')
        self.assertEqual(parsed['items'][0]['unit'], 'unidad')

    def test_parser_detects_prices_with_currency_and_thousand_separators(self):
        parsed = parse_invoice_text('Proveedor Demo\nMUZZ BARR 10 kg $10.500,00 $105.000,00\nTOTAL $105.000,00')
        self.assertEqual(len(parsed['items']), 1)
        self.assertEqual(parsed['items'][0]['unit_price'], '10500.00')
        self.assertEqual(parsed['items'][0]['subtotal'], '105000.00')

    def test_parser_classifies_real_invoice_fixture_semantically(self):
        text = Path(__file__).resolve().parent.joinpath('fixtures', 'factura_anonimizada.txt').read_text(encoding='utf-8')
        parsed = parse_invoice_text(text)
        classified = parsed['debug']['classified_lines']
        self.assertEqual(parsed['supplier']['name'], 'Distribuidora Sur SRL')
        self.assertIn('Av. Siempre Viva', parsed['supplier']['address'])
        self.assertEqual(parsed['supplier']['tax_id'], '20-12345678-9')
        self.assertEqual(parsed['document_number'], 'A-0001-00001234')
        self.assertEqual(parsed['date'], '2026-07-26')
        self.assertEqual(len(parsed['items']), 3)
        self.assertFalse(any(item['raw_line'] == 'Distribuidora Sur SRL' and item['classification'] == 'product_line' for item in classified))
        self.assertFalse(any('Siempre Viva' in item['raw_line'] and item['classification'] == 'product_line' for item in classified))
        self.assertTrue(any(item['classification'] == 'product_header' for item in classified))
        self.assertTrue(any(item['classification'] == 'tax' for item in classified))
        self.assertTrue(any(item['classification'] == 'total' for item in classified))

    def test_parser_uses_bounding_box_order_from_common_document(self):
        document = OCRDocument(
            raw_text='',
            provider='paddle',
            pages=[OCRPage(number=1)],
            lines=[
                OCRLine(text='MUZZ BARR 10 kg 10500 105000', box=OCRBox(10, 200, 300, 20)),
                OCRLine(text='Distribuidora Sur', box=OCRBox(10, 10, 300, 20)),
            ],
        )
        from .parser import parse_ocr_document

        parsed = parse_ocr_document(document)
        self.assertEqual(parsed['supplier']['name'], 'Distribuidora Sur')
        self.assertEqual(len(parsed['items']), 1)

    def test_layout_parser_keeps_header_buyer_address_out_of_items(self):
        document = OCRDocument(
            raw_text='',
            provider='paddle',
            pages=[OCRPage(number=1)],
            lines=[
                OCRLine(text='Distribuidora Sur SRL', box=OCRBox(20, 20, 220, 18)),
                OCRLine(text='Av. Siempre Viva 742 CP 1000', box=OCRBox(20, 48, 260, 18)),
                OCRLine(text='CUIT 20-12345678-9', box=OCRBox(20, 76, 180, 18)),
                OCRLine(text='Cliente Juan Perez', box=OCRBox(20, 104, 180, 18)),
                OCRLine(text='Calle Falsa 123 Piso 2', box=OCRBox(20, 132, 220, 18)),
                OCRLine(text='Factura A-0001-00001234', box=OCRBox(20, 160, 220, 18)),
                OCRLine(text='Codigo Descripcion Cantidad Unidad Precio Unitario Importe', box=OCRBox(20, 220, 520, 18)),
                OCRLine(text='001 MOZZARELLA BARRAZA 10 kg 10500 105000', box=OCRBox(20, 250, 460, 18)),
                OCRLine(text='002 ACEITE NATURA 2 unidad 1200 2400', box=OCRBox(20, 280, 430, 18)),
                OCRLine(text='Subtotal 107400', box=OCRBox(360, 330, 150, 18)),
                OCRLine(text='IVA 21% 22554', box=OCRBox(360, 360, 150, 18)),
                OCRLine(text='TOTAL 129954', box=OCRBox(360, 390, 150, 18)),
            ],
        )
        from .parser import parse_ocr_document

        parsed = parse_ocr_document(document)
        item_names = [item['detected_text'] for item in parsed['items']]

        self.assertTrue(parsed['table_detected'])
        self.assertEqual(len(parsed['items']), 2)
        self.assertIn('MOZZARELLA BARRAZA', item_names)
        self.assertIn('ACEITE NATURA', item_names)
        self.assertFalse(any('Siempre Viva' in name or 'Juan Perez' in name or 'Distribuidora' in name for name in item_names))
        self.assertTrue(any(item['classification'] == 'buyer' for item in parsed['ignored_regions']))
        self.assertTrue(any(item['classification'] == 'supplier_address' for item in parsed['ignored_regions']))

    def test_visual_table_reconstructs_distribimas_rows_and_columns(self):
        from .parser import parse_ocr_document

        rows = [
            self._ocr_line_from_cells(10, [('DISTRIMAS', 20)]),
            self._ocr_line_from_cells(30, [('San', 20), ('Juan', 48), ('1100,', 82), ('Garin', 126)]),
            self._ocr_line_from_cells(50, [('Cliente:', 20), ('CANDIA', 78), ('MAURICIO', 132)]),
            self._ocr_line_from_cells(70, [('RUMANIA', 20), ('3190', 82), ('ENTRE', 120), ('BELIERA', 166), ('Y', 226), ('HONDURAS;', 246), ('MAQUINISTA', 326), ('SAVIO', 410)]),
            self._ocr_line_from_cells(90, [('Tel:', 20), ('1157569391', 54)]),
            self._ocr_line_from_cells(110, [('Factura', 20), ('015', 78), ('Fecha', 130), ('14/07/2025', 182)]),
            self._ocr_line_from_cells(150, [('Código', 20), ('Denominación', 100), ('Cant.', 330), ('Importe', 430), ('Subtotal', 540)]),
            self._ocr_line_from_cells(175, [('792', 20), ('CARLOS', 100), ('CASARES', 152), ('000', 215), ('10', 330), ('12.222,00', 430), ('122.220,00', 540)]),
            self._ocr_line_from_cells(200, [('002', 20), ('0000', 100), ('BALATON', 142), ('2', 330), ('16.005,00', 430), ('32.010,00', 540)]),
            self._ocr_line_from_cells(225, [('108', 20), ('AZUCAR', 100), ('ESPECIAL', 154), ('X', 220), ('50', 242), ('1', 330), ('38.400,00', 430), ('38.400,00', 540)]),
            self._ocr_line_from_cells(250, [('138', 20), ('JALEA', 100), ('BRIX', 148), ('X', 190), ('10', 212), ('1', 330), ('16.000,00', 430), ('16.000,00', 540)]),
            self._ocr_line_from_cells(275, [('1045', 20), ('EL', 100), ('SERRANITO', 124), ('1', 330), ('25.000,00', 430), ('25.000,00', 540)]),
            self._ocr_line_from_cells(300, [('051', 20), ('GRAN', 100), ('HOJALDRE', 142), ('X', 210), ('10', 232), ('1', 330), ('38.350,00', 430), ('38.350,00', 540)]),
            self._ocr_line_from_cells(325, [('165', 20), ('ES.', 100), ('PAN', 132), ('DULCE', 166), ('EMETH', 214), ('X', 266), ('1', 288), ('1', 330), ('5.800,00', 430), ('5.800,00', 540)]),
            self._ocr_line_from_cells(360, [('TOTAL:', 430), ('$277.780,00', 540)]),
        ]
        document = OCRDocument(raw_text='\n'.join(line.text for line in rows), provider='paddle', pages=[OCRPage(number=1)], lines=rows)

        parsed = parse_ocr_document(document)

        self.assertTrue(parsed['table_detected'])
        self.assertEqual(len(parsed['items']), 7)
        self.assertEqual(parsed['supplier']['name'], 'DISTRIMAS')
        self.assertEqual(parsed['buyer']['name'], 'CANDIA MAURICIO')
        self.assertEqual(parsed['buyer']['phone'], '1157569391')
        self.assertEqual(parsed['date'], '2025-07-14')
        self.assertEqual(parsed['document_number'], '015')
        self.assertEqual(parsed['total'], '277780.00')
        self.assertEqual(parsed['subtotal'], '277780.00')
        descriptions = [item['description'] for item in parsed['items']]
        codes = [item['code'] for item in parsed['items']]
        self.assertEqual(codes[1], '002')
        self.assertEqual(codes[5], '051')
        self.assertIn('CARLOS CASARES 000', descriptions)
        self.assertIn('EL SERRANITO', descriptions)
        self.assertNotIn('1045', descriptions)
        self.assertNotIn('DISTRIMAS', descriptions)
        self.assertNotIn('CANDIA MAURICIO', descriptions)
        self.assertIn('column_boundaries', parsed['debug']['visual_table'])

    def test_matcher_uses_alias_with_high_confidence(self):
        IngredientAlias.objects.create(ingredient=self.ingredient, supplier=self.supplier, detected_text='MUZZ BARR', times_confirmed=3)
        match = match_line_to_ingredient('MUZZ BARR', self.business, self.supplier)
        self.assertEqual(match['ingredient'], self.ingredient)
        self.assertGreaterEqual(match['confidence'], 90)
        self.assertFalse(match['requires_review'])

    def test_ocr_endpoint_returns_structure_without_creating_stock_movements(self):
        response = self.client.post(reverse('purchase-ocr'), {
            'business_id': self.business.id,
            'raw_text': 'Distribuidora Sur\nFactura A-0001-00001234\nMUZZ BARR 10 kg 10500 105000\nTOTAL $105000',
        })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['status'], 'success')
        self.assertEqual(response.data['provider'], 'manual-dev-input')
        self.assertEqual(response.data['document_number'], 'A-0001-00001234')
        self.assertEqual(len(response.data['items']), 1)
        self.assertIn('processing_time_ms', response.data)
        self.assertEqual(InventoryMovement.objects.count(), 0)

    def test_ocr_endpoint_rejects_foreign_business(self):
        other_user = get_user_model().objects.create_user(username='other-ocr', password='pass12345')
        other_business = Negocio.objects.create(user=other_user, name='Ajeno')
        response = self.client.post(reverse('purchase-ocr'), {'business_id': other_business.id, 'raw_text': 'x'})
        self.assertEqual(response.status_code, 404)

    @override_settings(OCR_PROVIDER='none')
    def test_provider_not_configured_status(self):
        status = get_ocr_status()
        self.assertFalse(status['available'])
        self.assertEqual(status['provider'], 'none')

    @override_settings(OCR_PROVIDER='paddle')
    def test_paddle_provider_available_status(self):
        with patch('ocr.providers.paddle.PaddleOCRProvider.is_available', return_value=(True, 'PaddleOCR disponible.')):
            status = get_ocr_status()
        self.assertTrue(status['available'])
        self.assertEqual(status['provider'], 'paddle')
        self.assertIn('language', status)
        self.assertIn('ocr_version', status)

    @override_settings(OCR_PROVIDER='paddle', OCR_PADDLE_LANG='xx')
    def test_invalid_paddle_language_returns_unavailable_status(self):
        status = get_ocr_status()
        self.assertFalse(status['available'])
        self.assertEqual(status['language'], 'xx')
        self.assertIn('Idioma PaddleOCR invalido', status['message'])

    @override_settings(OCR_PROVIDER='paddle', OCR_PADDLE_LANG='es', OCR_PADDLE_VERSION='')
    def test_valid_paddle_language_and_default_version(self):
        status = get_ocr_status()
        self.assertEqual(status['language'], 'es')
        self.assertEqual(status['ocr_version'], '')

    @override_settings(OCR_PROVIDER='paddle')
    def test_paddle_extraction_successful_simulated(self):
        document = OCRDocument(
            raw_text='Distribuidora Sur\nMUZZ BARR 10 kg 10500 105000',
            provider='paddle',
            pages=[OCRPage(number=1)],
            lines=[OCRLine(text='MUZZ BARR 10 kg 10500 105000', confidence=95, box=OCRBox(10, 20, 300, 30))],
            confidence=95,
        )
        image = SimpleUploadedFile('factura.png', b'image-bytes', content_type='image/png')
        with patch('ocr.providers.paddle.PaddleOCRProvider.is_available', return_value=(True, 'ok')), patch('ocr.providers.paddle.PaddleOCRProvider.extract_document', return_value=document):
            result = extract_document(image=image)
        self.assertEqual(result.provider, 'paddle')
        self.assertEqual(result.lines[0].box.left, 10)

    @override_settings(OCR_PROVIDER='paddle')
    def test_paddle_not_available_raises_clear_error(self):
        image = SimpleUploadedFile('factura.png', b'image-bytes', content_type='image/png')
        with patch('ocr.providers.paddle.PaddleOCRProvider.is_available', return_value=(False, 'PaddleOCR no esta disponible')):
            with self.assertRaises(OCREngineNotAvailable):
                extract_document(image=image)

    @override_settings(OCR_PROVIDER='paddle', OCR_PADDLE_LANG='xx')
    def test_endpoint_returns_controlled_configuration_error(self):
        image = SimpleUploadedFile('factura.png', b'image-bytes', content_type='image/png')
        response = self.client.post(reverse('purchase-ocr'), {'business_id': self.business.id, 'image': image})
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.data['status'], 'error')
        self.assertEqual(response.data['code'], 'OCR_ENGINE_CONFIGURATION_ERROR')
        self.assertIn('message', response.data)
        self.assertIn('processing_time_ms', response.data)

    @override_settings(OCR_PROVIDER='paddle', OCR_PADDLE_LANG='es', OCR_PADDLE_VERSION='')
    def test_paddle_engine_is_reused_between_requests(self):
        from ocr.providers import paddle as paddle_provider_module
        from ocr.providers.paddle import PaddleOCRProvider

        created = []

        class FakePaddleOCR:
            def __init__(self, **kwargs):
                created.append(kwargs)

        with patch.dict(paddle_provider_module._ENGINE_CACHE, {}, clear=True), patch.dict(sys.modules, {'paddleocr': SimpleNamespace(PaddleOCR=FakePaddleOCR)}):
            provider = PaddleOCRProvider()
            first = provider._load_engine()
            second = provider._load_engine()

        self.assertIs(first, second)
        self.assertEqual(len(created), 1)

    def test_invalid_image_raises_clear_error(self):
        image = SimpleUploadedFile('factura.png', b'not-really-an-image', content_type='image/png')
        with self.assertRaises(OCRInvalidImage):
            prepare_image(image)

    def test_successful_extraction_simulated_reaches_parser_and_endpoint(self):
        image = SimpleUploadedFile('factura.png', b'image-bytes', content_type='image/png')
        document = OCRDocument(
            raw_text='Distribuidora Sur\nFactura A-0001-00001234\nMUZZ BARR 10 kg 10500 105000\nTOTAL $105000',
            provider='paddle',
            lines=[OCRLine(text='MUZZ BARR 10 kg 10500 105000', box=OCRBox(1, 1, 100, 20))],
            metadata={'language': 'es'},
        )
        with patch('purchases.views.extract_document', return_value=document):
            response = self.client.post(reverse('purchase-ocr'), {'business_id': self.business.id, 'image': image})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['status'], 'success')
        self.assertEqual(response.data['provider'], 'paddle')
        self.assertEqual(response.data['ocr_provider'], 'paddle')
        self.assertEqual(response.data['items'][0]['detected_text'], 'MUZZ BARR')
        self.assertIn('unresolved_lines', response.data)

    @override_settings(OCR_PROVIDER='paddle')
    def test_ocr_endpoint_returns_friendly_error_when_engine_missing(self):
        image = SimpleUploadedFile('factura.png', b'image-bytes', content_type='image/png')
        with patch('ocr.providers.paddle.PaddleOCRProvider.is_available', return_value=(False, 'PaddleOCR no esta disponible')):
            response = self.client.post(reverse('purchase-ocr'), {'business_id': self.business.id, 'image': image})
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.data['status'], 'error')
        self.assertEqual(response.data['code'], 'OCR_ENGINE_NOT_AVAILABLE')
        self.assertIn('message', response.data)
        self.assertIn('manualmente', response.data['manual_fallback'])

    def test_ocr_status_requires_authentication(self):
        client = APIClient()
        response = client.get(reverse('ocr_status'))
        self.assertEqual(response.status_code, 401)

    def test_ocr_status_endpoint_is_authenticated_and_safe(self):
        with patch('ocr.providers.paddle.PaddleOCRProvider.is_available', return_value=(True, 'ok')):
            response = self.client.get(reverse('ocr_status'))
        self.assertEqual(response.status_code, 200)
        self.assertIn('provider', response.data)
        self.assertIn('available', response.data)

    @override_settings(OCR_PROVIDER='paddle_service', OCR_SERVICE_URL='http://127.0.0.1:8010')
    def test_factory_uses_paddle_service_without_importing_local_paddle_modules(self):
        sys.modules.pop('paddle', None)
        sys.modules.pop('paddleocr', None)
        sys.modules.pop('ocr.providers.paddle', None)
        from ocr.providers.factory import get_provider
        from ocr.providers.paddle_service import PaddleServiceProvider

        provider = get_provider()

        self.assertIsInstance(provider, PaddleServiceProvider)
        self.assertNotIn('paddle', sys.modules)
        self.assertNotIn('paddleocr', sys.modules)
        self.assertNotIn('ocr.providers.paddle', sys.modules)

    @override_settings(OCR_PROVIDER='paddle_service', OCR_SERVICE_URL='http://127.0.0.1:8010')
    def test_paddle_service_status_unavailable_when_not_started(self):
        with patch('ocr.providers.paddle_service.requests.get', side_effect=requests.ConnectionError()):
            status = get_ocr_status()
        self.assertFalse(status['available'])
        self.assertEqual(status['provider'], 'paddle_service')
        self.assertIn('no esta iniciado', status['message'])

    @override_settings(OCR_PROVIDER='paddle_service', OCR_SERVICE_URL='http://127.0.0.1:8010')
    def test_paddle_service_timeout_returns_friendly_endpoint_error(self):
        image = SimpleUploadedFile('factura.png', b'image-bytes', content_type='image/png')
        with patch('ocr.providers.paddle_service.PaddleServiceProvider.is_available', return_value=(True, 'ok')), patch('ocr.providers.paddle_service.requests.post', side_effect=requests.Timeout()):
            response = self.client.post(reverse('purchase-ocr'), {'business_id': self.business.id, 'image': image})
        self.assertEqual(response.status_code, 504)
        self.assertEqual(response.data['status'], 'error')
        self.assertEqual(response.data['code'], 'OCR_SERVICE_TIMEOUT')

    @override_settings(OCR_PROVIDER='paddle_service', OCR_SERVICE_URL='http://127.0.0.1:8010')
    def test_paddle_service_valid_response_is_transformed_by_django(self):
        image = SimpleUploadedFile('factura.png', b'image-bytes', content_type='image/png')

        class FakeResponse:
            status_code = 200

            def json(self):
                return {
                    'provider': 'paddle',
                    'raw_text': 'Distribuidora Sur\nFactura A-0001-00001234\nMUZZ BARR 10 kg 10500 105000\nTOTAL $105000',
                    'lines': [{'text': 'MUZZ BARR 10 kg 10500 105000', 'confidence': 95, 'box': {'left': 1, 'top': 1, 'width': 100, 'height': 20}, 'words': []}],
                    'pages': [{'number': 1}],
                    'words': [],
                    'confidence': 95,
                    'warnings': [],
                    'metadata': {'processing_time_ms': 10},
                }

        with patch('ocr.providers.paddle_service.PaddleServiceProvider.is_available', return_value=(True, 'ok')), patch('ocr.providers.paddle_service.requests.post', return_value=FakeResponse()):
            response = self.client.post(reverse('purchase-ocr'), {'business_id': self.business.id, 'image': image})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['status'], 'success')
        self.assertEqual(response.data['provider'], 'paddle')
        self.assertEqual(response.data['items'][0]['detected_text'], 'MUZZ BARR')

    @override_settings(OCR_PROVIDER='paddle_service', OCR_SERVICE_URL='http://127.0.0.1:8010')
    def test_paddle_service_invalid_response_returns_friendly_error(self):
        image = SimpleUploadedFile('factura.png', b'image-bytes', content_type='image/png')

        class FakeResponse:
            status_code = 200

            def json(self):
                return {'provider': 'paddle'}

        with patch('ocr.providers.paddle_service.PaddleServiceProvider.is_available', return_value=(True, 'ok')), patch('ocr.providers.paddle_service.requests.post', return_value=FakeResponse()):
            response = self.client.post(reverse('purchase-ocr'), {'business_id': self.business.id, 'image': image})
        self.assertEqual(response.status_code, 502)
        self.assertEqual(response.data['status'], 'error')
        self.assertEqual(response.data['code'], 'OCR_SERVICE_INVALID_RESPONSE')

    @override_settings(OCR_PROVIDER='openai_vision', OPENAI_API_KEY='sk-test', OPENAI_VISION_MODEL='gpt-test')
    def test_factory_uses_openai_vision_provider(self):
        from ocr.providers.factory import get_provider
        from ocr.providers.openai_vision import OpenAIVisionProvider

        provider = get_provider()

        self.assertIsInstance(provider, OpenAIVisionProvider)
        self.assertEqual(provider.get_model(), 'gpt-test')

    @override_settings(OCR_PROVIDER='openai_vision', OPENAI_API_KEY='', OPENAI_VISION_MODEL='gpt-test')
    def test_openai_vision_not_configured_returns_friendly_endpoint_error(self):
        image = SimpleUploadedFile('factura.png', b'image-bytes', content_type='image/png')

        response = self.client.post(reverse('purchase-ocr'), {'business_id': self.business.id, 'image': image})

        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.data['status'], 'error')
        self.assertEqual(response.data['code'], 'OCR_ENGINE_NOT_AVAILABLE')
        self.assertIn('OPENAI_API_KEY', response.data['message'])
        self.assertIn('manualmente', response.data['manual_fallback'])

    @override_settings(OCR_PROVIDER='openai_vision', OPENAI_API_KEY='sk-test', OPENAI_VISION_MODEL='')
    def test_openai_vision_missing_model_is_reported_in_status(self):
        response = self.client.get(reverse('ocr_status'))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['provider'], 'openai_vision')
        self.assertFalse(response.data['available'])
        self.assertIn('OPENAI_VISION_MODEL', response.data['message'])

    @override_settings(OCR_PROVIDER='openai_vision', OPENAI_API_KEY='sk-test', OPENAI_VISION_MODEL='gpt-test')
    def test_openai_vision_valid_structured_response_for_distribimas_invoice(self):
        image = SimpleUploadedFile('distribimas.png', b'image-bytes', content_type='image/png')
        structured = {
            'supplier': {'name': 'DISTRIMAS', 'address': None, 'tax_id': None},
            'buyer': {'name': 'CANDIA MAURICIO', 'address': 'RUMANIA 3190', 'phone': None},
            'document': {
                'type': 'Factura',
                'number': None,
                'date': None,
                'subtotal': '277.780,00',
                'taxes': None,
                'discount': None,
                'total': '277.780,00',
                'currency': 'ARS',
            },
            'items': [
                {'code': '792', 'description': 'CARLOS CASARES 000', 'quantity': '10', 'unit': None, 'unit_price': '12.222,00', 'subtotal': '122.220,00', 'confidence': 96, 'needs_review': False},
                {'code': '002', 'description': '0000 BALATON', 'quantity': '2', 'unit': None, 'unit_price': '16.005,00', 'subtotal': '32.010,00', 'confidence': 95, 'needs_review': False},
                {'code': '108', 'description': 'AZUCAR ESPECIAL X 50', 'quantity': '1', 'unit': None, 'unit_price': '38.400,00', 'subtotal': '38.400,00', 'confidence': 95, 'needs_review': False},
                {'code': '138', 'description': 'JALEA BRIX X 10', 'quantity': '1', 'unit': None, 'unit_price': '16.000,00', 'subtotal': '16.000,00', 'confidence': 95, 'needs_review': False},
                {'code': '1045', 'description': 'EL SERRANITO', 'quantity': '1', 'unit': None, 'unit_price': '25.000,00', 'subtotal': '25.000,00', 'confidence': 95, 'needs_review': False},
                {'code': '051', 'description': 'GRAN HOJALDRE X 10', 'quantity': '1', 'unit': None, 'unit_price': '38.350,00', 'subtotal': '38.350,00', 'confidence': 95, 'needs_review': False},
                {'code': '165', 'description': 'ES. PAN DULCE EMETH X 1', 'quantity': '1', 'unit': None, 'unit_price': '5.800,00', 'subtotal': '5.800,00', 'confidence': 95, 'needs_review': False},
            ],
            'warnings': [],
        }

        class FakeResponse:
            status_code = 200

            def json(self):
                return {'output_text': json.dumps(structured)}

        with patch('ocr.providers.openai_vision.requests.post', return_value=FakeResponse()):
            response = self.client.post(reverse('purchase-ocr'), {'business_id': self.business.id, 'image': image})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['provider'], 'openai_vision')
        self.assertEqual(response.data['supplier']['name'], 'DISTRIMAS')
        self.assertEqual(response.data['buyer']['name'], 'CANDIA MAURICIO')
        self.assertEqual(response.data['buyer']['address'], 'RUMANIA 3190')
        self.assertEqual(response.data['total'], '277.780,00')
        self.assertEqual(response.data['summary']['items_found'], 7)
        descriptions = [item['detected_text'] for item in response.data['items']]
        self.assertIn('CARLOS CASARES 000', descriptions)
        self.assertIn('0000 BALATON', descriptions)
        self.assertNotIn('CANDIA MAURICIO', descriptions)
        self.assertNotIn('RUMANIA 3190', descriptions)
        self.assertEqual(response.data['items'][1]['code'], '002')

    @override_settings(OCR_PROVIDER='openai_vision', OPENAI_API_KEY='sk-test', OPENAI_VISION_MODEL='gpt-test')
    def test_openai_vision_sum_mismatch_marks_items_for_review(self):
        image = SimpleUploadedFile('factura.png', b'image-bytes', content_type='image/png')
        structured = {
            'supplier': {'name': 'Proveedor', 'address': None, 'tax_id': None},
            'buyer': {'name': None, 'address': None, 'phone': None},
            'document': {'type': None, 'number': None, 'date': None, 'subtotal': None, 'taxes': None, 'discount': None, 'total': '100.000,00', 'currency': 'ARS'},
            'items': [{'code': '001', 'description': 'HARINA 000', 'quantity': '1', 'unit': None, 'unit_price': '10.000,00', 'subtotal': '10.000,00', 'confidence': 97, 'needs_review': False}],
            'warnings': [],
        }

        class FakeResponse:
            status_code = 200

            def json(self):
                return {'output_text': json.dumps(structured)}

        with patch('ocr.providers.openai_vision.requests.post', return_value=FakeResponse()):
            response = self.client.post(reverse('purchase-ocr'), {'business_id': self.business.id, 'image': image})

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data['items'][0]['requires_review'])
        self.assertIn('La suma de las lineas no coincide', ' '.join(response.data['warnings']))

    @override_settings(OCR_PROVIDER='openai_vision', OPENAI_API_KEY='sk-test', OPENAI_VISION_MODEL='gpt-test')
    def test_openai_vision_invalid_json_returns_friendly_error(self):
        image = SimpleUploadedFile('factura.png', b'image-bytes', content_type='image/png')

        class FakeResponse:
            status_code = 200

            def json(self):
                return {'output_text': 'no-json'}

        with patch('ocr.providers.openai_vision.requests.post', return_value=FakeResponse()):
            response = self.client.post(reverse('purchase-ocr'), {'business_id': self.business.id, 'image': image})

        self.assertEqual(response.status_code, 502)
        self.assertEqual(response.data['code'], 'OCR_SERVICE_INVALID_RESPONSE')

    @override_settings(OCR_PROVIDER='openai_vision', OPENAI_API_KEY='sk-test', OPENAI_VISION_MODEL='gpt-test')
    def test_openai_vision_timeout_returns_friendly_error(self):
        image = SimpleUploadedFile('factura.png', b'image-bytes', content_type='image/png')

        with patch('ocr.providers.openai_vision.requests.post', side_effect=requests.Timeout()):
            response = self.client.post(reverse('purchase-ocr'), {'business_id': self.business.id, 'image': image})

        self.assertEqual(response.status_code, 504)
        self.assertEqual(response.data['code'], 'OCR_SERVICE_TIMEOUT')
