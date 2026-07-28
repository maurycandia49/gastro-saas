import base64
import json
import mimetypes
import time

import requests
from django.conf import settings

from .base import OCRDocument


OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses'


INVOICE_SCHEMA = {
    'type': 'object',
    'additionalProperties': False,
    'required': ['supplier', 'buyer', 'document', 'items', 'warnings'],
    'properties': {
        'supplier': {
            'type': 'object',
            'additionalProperties': False,
            'required': ['name', 'address', 'tax_id'],
            'properties': {
                'name': {'type': ['string', 'null']},
                'address': {'type': ['string', 'null']},
                'tax_id': {'type': ['string', 'null']},
            },
        },
        'buyer': {
            'type': 'object',
            'additionalProperties': False,
            'required': ['name', 'address', 'phone'],
            'properties': {
                'name': {'type': ['string', 'null']},
                'address': {'type': ['string', 'null']},
                'phone': {'type': ['string', 'null']},
            },
        },
        'document': {
            'type': 'object',
            'additionalProperties': False,
            'required': ['type', 'number', 'date', 'subtotal', 'taxes', 'discount', 'total', 'currency'],
            'properties': {
                'type': {'type': ['string', 'null']},
                'number': {'type': ['string', 'null']},
                'date': {'type': ['string', 'null']},
                'subtotal': {'type': ['string', 'null']},
                'taxes': {'type': ['string', 'null']},
                'discount': {'type': ['string', 'null']},
                'total': {'type': ['string', 'null']},
                'currency': {'type': ['string', 'null']},
            },
        },
        'items': {
            'type': 'array',
            'items': {
                'type': 'object',
                'additionalProperties': False,
                'required': ['code', 'description', 'quantity', 'unit', 'unit_price', 'subtotal', 'confidence', 'needs_review'],
                'properties': {
                    'code': {'type': ['string', 'null']},
                    'description': {'type': 'string'},
                    'quantity': {'type': ['string', 'null']},
                    'unit': {'type': ['string', 'null']},
                    'unit_price': {'type': ['string', 'null']},
                    'subtotal': {'type': ['string', 'null']},
                    'confidence': {'type': 'number', 'minimum': 0, 'maximum': 100},
                    'needs_review': {'type': 'boolean'},
                },
            },
        },
        'warnings': {'type': 'array', 'items': {'type': 'string'}},
    },
}


SYSTEM_PROMPT = """Analizá comprobantes comerciales argentinos desde la imagen completa.
Detectá primero la tabla visual de productos y verificá columnas por posición visual.
Distinguí proveedor, comprador/cliente y direcciones. Excluí de items nombres de personas,
proveedor, direcciones, teléfonos, CUIT/DNI, fechas, títulos, encabezados, subtotales,
impuestos, descuentos, CAE y total.
Solo extraé productos ubicados dentro de la tabla visual. Conservá texto exacto de códigos
y descripciones, incluyendo ceros iniciales. No conviertas nombres comerciales a ingredientes.
No corrijas ortografía. No inventes datos: devolvé null cuando no se pueda determinar.
Interpretá importes argentinos con punto de miles y coma decimal. Si la tabla no es confiable,
devolvé items=[] y agregá un warning. Respondé únicamente con JSON que cumpla el schema."""


class OpenAIVisionProvider:
    name = 'openai_vision'

    def get_model(self):
        return getattr(settings, 'OPENAI_VISION_MODEL', '')

    def get_timeout(self):
        return getattr(settings, 'OCR_TIMEOUT_SECONDS', 120)

    def is_available(self):
        if not getattr(settings, 'OPENAI_API_KEY', ''):
            return False, 'OPENAI_API_KEY no esta configurada.'
        if not self.get_model():
            return False, 'OPENAI_VISION_MODEL no esta configurado.'
        return True, 'OpenAI Vision configurado.'

    def status(self):
        available, message = self.is_available()
        return {'provider': self.name, 'available': available, 'language': '', 'ocr_version': self.get_model(), 'message': message}

    def _image_data_url(self, image):
        try:
            image.seek(0)
        except Exception:
            pass
        data = image.read()
        try:
            image.seek(0)
        except Exception:
            pass
        content_type = getattr(image, 'content_type', '') or mimetypes.guess_type(getattr(image, 'name', 'invoice.png'))[0] or 'image/png'
        return f'data:{content_type};base64,{base64.b64encode(data).decode("ascii")}'

    def _extract_output_json(self, payload):
        if 'output_text' in payload:
            return json.loads(payload['output_text'])
        for item in payload.get('output', []):
            for content in item.get('content', []):
                if content.get('type') in {'output_text', 'text'} and content.get('text'):
                    return json.loads(content['text'])
        from ocr.services import OCRServiceInvalidResponse
        raise OCRServiceInvalidResponse()

    def extract_document(self, image):
        from ocr.services import OCREngineNotAvailable, OCRServiceTimeout, OCRServiceInvalidResponse, OCRError

        available, message = self.is_available()
        if not available:
            raise OCREngineNotAvailable(f'OpenAI Vision no esta configurado. {message}')
        started_at = time.perf_counter()
        body = {
            'model': self.get_model(),
            'store': False,
            'input': [
                {'role': 'system', 'content': [{'type': 'input_text', 'text': SYSTEM_PROMPT}]},
                {'role': 'user', 'content': [
                    {'type': 'input_text', 'text': 'Extrae el comprobante segun el schema. No agregues texto fuera del JSON.'},
                    {'type': 'input_image', 'image_url': self._image_data_url(image), 'detail': 'high'},
                ]},
            ],
            'text': {
                'format': {
                    'type': 'json_schema',
                    'name': 'pedilo_invoice_analysis',
                    'strict': True,
                    'schema': INVOICE_SCHEMA,
                }
            },
        }
        try:
            response = requests.post(
                OPENAI_RESPONSES_URL,
                headers={'Authorization': f'Bearer {settings.OPENAI_API_KEY}', 'Content-Type': 'application/json'},
                json=body,
                timeout=self.get_timeout(),
            )
        except requests.Timeout:
            raise OCRServiceTimeout()
        except requests.RequestException as exc:
            raise OCRError('OPENAI_VISION_REQUEST_FAILED', f'No pudimos conectar con OpenAI Vision: {exc}', 503)
        if response.status_code >= 400:
            raise OCRError('OPENAI_VISION_REQUEST_FAILED', 'OpenAI Vision no pudo analizar el comprobante.', 503)
        try:
            structured = self._extract_output_json(response.json())
        except (ValueError, TypeError, json.JSONDecodeError):
            raise OCRServiceInvalidResponse()
        return OCRDocument(
            raw_text=json.dumps(structured, ensure_ascii=False),
            provider=self.name,
            lines=[],
            words=[],
            confidence=None,
            warnings=structured.get('warnings') or [],
            metadata={'structured_invoice': structured, 'processing_time_ms': int((time.perf_counter() - started_at) * 1000), 'model': self.get_model()},
        )
