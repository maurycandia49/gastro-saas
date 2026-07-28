from .providers.base import OCRDocument
from .providers.factory import get_provider, get_provider_name
from django.conf import settings
import logging

logger = logging.getLogger(__name__)


class OCRError(Exception):
    status_code = 400

    def __init__(self, code, message, status_code=None):
        self.code = code
        self.message = message
        if status_code:
            self.status_code = status_code
        super().__init__(message)


class OCRProviderNotConfigured(OCRError):
    def __init__(self):
        super().__init__('OCR_PROVIDER_NOT_CONFIGURED', 'No hay proveedor OCR configurado.', 503)


class OCREngineNotAvailable(OCRError):
    def __init__(self, message=None):
        super().__init__('OCR_ENGINE_NOT_AVAILABLE', message or 'El motor OCR configurado no esta disponible.', 503)


class OCREngineConfigurationError(OCRError):
    def __init__(self, message=None):
        super().__init__('OCR_ENGINE_CONFIGURATION_ERROR', message or 'La configuracion del motor OCR no es valida.', 503)


class OCRInvalidImage(OCRError):
    def __init__(self):
        super().__init__('OCR_INVALID_IMAGE', 'La imagen no es valida. Usa JPG, PNG o WEBP.', 400)


class OCRServiceUnavailable(OCRError):
    def __init__(self):
        super().__init__('OCR_SERVICE_UNAVAILABLE', 'El lector de comprobantes no esta iniciado.', 503)


class OCRServiceTimeout(OCRError):
    def __init__(self):
        super().__init__('OCR_SERVICE_TIMEOUT', 'El lector de comprobantes tardo demasiado en responder.', 504)


class OCRServiceInvalidResponse(OCRError):
    def __init__(self):
        super().__init__('OCR_SERVICE_INVALID_RESPONSE', 'El lector de comprobantes devolvio una respuesta invalida.', 502)


def get_ocr_status():
    provider = get_provider()
    logger.info(
        'OCR status using settings.OCR_PROVIDER=%s provider_class=%s.%s service_url=%s',
        get_provider_name(),
        provider.__class__.__module__,
        provider.__class__.__name__,
        getattr(settings, 'OCR_SERVICE_URL', ''),
    )
    if hasattr(provider, 'status'):
        return provider.status()
    available, message = provider.is_available()
    return {'provider': provider.name or get_provider_name(), 'available': available, 'language': '', 'ocr_version': '', 'message': message}


def extract_document(image=None, raw_text=''):
    if raw_text:
        lines = []
        from .providers.base import OCRLine, OCRPage

        for line in [item.strip() for item in raw_text.splitlines() if item.strip()]:
            lines.append(OCRLine(text=line))
        return OCRDocument(raw_text=raw_text, provider='manual-dev-input', pages=[OCRPage(number=1, lines=lines)], lines=lines, words=[], confidence=None)
    if not image:
        raise OCRError('NO_IMAGE_PROVIDED', 'Adjunta una imagen de factura para escanear.', 400)
    provider = get_provider()
    logger.info(
        'OCR extract using settings.OCR_PROVIDER=%s provider_class=%s.%s service_url=%s',
        get_provider_name(),
        provider.__class__.__module__,
        provider.__class__.__name__,
        getattr(settings, 'OCR_SERVICE_URL', ''),
    )
    available, message = provider.is_available()
    if not available:
        if 'Idioma PaddleOCR invalido' in message:
            raise OCREngineConfigurationError(message)
        raise OCREngineNotAvailable(message)
    return provider.extract_document(image)


def extract_text(image=None, raw_text=''):
    document = extract_document(image=image, raw_text=raw_text)
    return {
        'text': document.raw_text,
        'provider': document.provider,
        'warnings': document.warnings,
        'metadata': document.metadata,
        'document': document,
    }
