from django.conf import settings
import logging

from .base import OCRProvider

logger = logging.getLogger(__name__)


class UnimplementedProvider(OCRProvider):
    def __init__(self, name):
        self.name = name

    def is_available(self):
        return False, f'Proveedor {self.name} reservado para arquitectura futura; no implementado.'

    def status(self):
        available, message = self.is_available()
        return {'provider': self.name, 'available': available, 'language': '', 'ocr_version': '', 'message': message}


class NoneProvider(OCRProvider):
    name = 'none'

    def is_available(self):
        return False, 'No hay proveedor OCR activo.'

    def status(self):
        available, message = self.is_available()
        return {'provider': self.name, 'available': available, 'language': '', 'ocr_version': '', 'message': message}


def get_provider_name():
    return getattr(settings, 'OCR_PROVIDER', 'service') or 'none'


def get_provider(name=None):
    provider = name or get_provider_name()
    logger.info('OCR factory requested provider=%s service_url=%s', provider, getattr(settings, 'OCR_SERVICE_URL', ''))
    if provider in {'service', 'paddle_service', 'paddle'}:
        from .paddle_service import PaddleServiceProvider

        logger.info('OCR factory selected %s.%s', PaddleServiceProvider.__module__, PaddleServiceProvider.__name__)
        return PaddleServiceProvider()
    if provider == 'paddle_local':
        from .paddle import PaddleOCRProvider

        logger.warning('OCR factory selected local PaddleOCRProvider inside Django process.')
        return PaddleOCRProvider()
    if provider == 'openai_vision':
        from .openai_vision import OpenAIVisionProvider

        logger.info('OCR factory selected %s.%s', OpenAIVisionProvider.__module__, OpenAIVisionProvider.__name__)
        return OpenAIVisionProvider()
    if provider in {'google_document_ai', 'tesseract', 'azure', 'aws'}:
        return UnimplementedProvider(provider)
    return NoneProvider()
