from django.conf import settings
import mimetypes
import requests

from .base import OCRBox, OCRDocument, OCRLine, OCRPage, OCRProvider, OCRWord


class PaddleServiceProvider(OCRProvider):
    name = 'paddle_service'

    def get_service_url(self):
        return getattr(settings, 'OCR_SERVICE_URL', 'http://127.0.0.1:8010').rstrip('/')

    def get_timeout(self):
        return getattr(settings, 'OCR_TIMEOUT_SECONDS', 120)

    def status(self):
        try:
            response = requests.get(f'{self.get_service_url()}/status', timeout=5)
            response.raise_for_status()
            data = response.json()
        except requests.RequestException:
            return {
                'provider': self.name,
                'available': False,
                'language': '',
                'ocr_version': '',
                'message': 'El lector de comprobantes no esta iniciado.',
            }
        except ValueError:
            return {
                'provider': self.name,
                'available': False,
                'language': '',
                'ocr_version': '',
                'message': 'El lector de comprobantes devolvio una respuesta invalida.',
            }

        return {
            'provider': data.get('provider', 'paddle'),
            'available': bool(data.get('available')),
            'language': data.get('language', ''),
            'ocr_version': data.get('paddleocr_version', ''),
            'python_version': data.get('python_version', ''),
            'paddle_version': data.get('paddle_version', ''),
            'message': data.get('message', ''),
        }

    def is_available(self):
        status = self.status()
        return status['available'], status['message']

    def _box_from_payload(self, payload):
        if not payload:
            return None
        return OCRBox(
            left=float(payload.get('left', 0)),
            top=float(payload.get('top', 0)),
            width=float(payload.get('width', 0)),
            height=float(payload.get('height', 0)),
        )

    def _document_from_payload(self, data):
        if not isinstance(data, dict) or 'raw_text' not in data or 'lines' not in data:
            from ocr.services import OCRServiceInvalidResponse

            raise OCRServiceInvalidResponse()

        words = []
        lines = []
        for item in data.get('lines') or []:
            line_words = [
                OCRWord(
                    text=str(word.get('text', '')),
                    confidence=word.get('confidence'),
                    box=self._box_from_payload(word.get('box')),
                )
                for word in item.get('words', [])
            ]
            words.extend(line_words)
            lines.append(
                OCRLine(
                    text=str(item.get('text', '')),
                    confidence=item.get('confidence'),
                    box=self._box_from_payload(item.get('box')),
                    words=line_words,
                )
            )

        pages = [
            OCRPage(
                number=int(page.get('number', index + 1)),
                width=page.get('width'),
                height=page.get('height'),
                lines=lines if index == 0 else [],
            )
            for index, page in enumerate(data.get('pages') or [{'number': 1}])
        ]
        if not pages:
            pages = [OCRPage(number=1, lines=lines)]

        return OCRDocument(
            raw_text=str(data.get('raw_text') or ''),
            provider=str(data.get('provider') or 'paddle'),
            pages=pages,
            lines=lines,
            words=words,
            confidence=data.get('confidence'),
            warnings=data.get('warnings') or [],
            metadata=data.get('metadata') or {},
        )

    def extract_document(self, image):
        try:
            image.seek(0)
        except Exception:
            pass
        files = {
            'image': (
                getattr(image, 'name', 'invoice.png'),
                image,
                getattr(image, 'content_type', '') or mimetypes.guess_type(getattr(image, 'name', 'invoice.png'))[0] or 'application/octet-stream',
            )
        }
        try:
            response = requests.post(
                f'{self.get_service_url()}/analyze',
                files=files,
                timeout=self.get_timeout(),
            )
        except requests.Timeout:
            from ocr.services import OCRServiceTimeout

            raise OCRServiceTimeout()
        except requests.RequestException:
            from ocr.services import OCRServiceUnavailable

            raise OCRServiceUnavailable()
        finally:
            try:
                image.seek(0)
            except Exception:
                pass

        try:
            data = response.json()
        except ValueError:
            from ocr.services import OCRServiceInvalidResponse

            raise OCRServiceInvalidResponse()

        if response.status_code >= 400:
            from ocr.services import OCREngineNotAvailable, OCRError

            code = data.get('code', 'OCR_PROCESSING_FAILED')
            message = data.get('message', 'No pudimos leer esta factura.')
            if code == 'OCR_ENGINE_NOT_AVAILABLE':
                raise OCREngineNotAvailable(message)
            raise OCRError(code, message, response.status_code)

        return self._document_from_payload(data)
