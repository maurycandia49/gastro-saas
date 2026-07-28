from django.conf import settings
import logging
import time

from .base import OCRBox, OCRDocument, OCRLine, OCRPage, OCRProvider, OCRWord, cleanup_temp, prepare_image

logger = logging.getLogger(__name__)

SUPPORTED_LANGUAGES = {
    'en', 'ch', 'chinese_cht', 'ta', 'te', 'ka', 'latin', 'arabic', 'cyrillic', 'devanagari',
    'es', 'pt', 'fr', 'de', 'it', 'ru', 'japan', 'korean',
}
DEFAULT_LANGUAGE = 'es'
_ENGINE_CACHE = {}


class PaddleOCRProvider(OCRProvider):
    name = 'paddle'

    def _configure_cache(self):
        import os

        cache_dir = str(settings.BASE_DIR / '.paddlex')
        os.makedirs(cache_dir, exist_ok=True)
        os.environ.setdefault('PADDLE_HOME', cache_dir)
        os.environ.setdefault('PADDLEX_HOME', cache_dir)
        os.environ.setdefault('PADDLEX_CACHE_DIR', cache_dir)
        os.environ.setdefault('PADDLE_PDX_CACHE_HOME', cache_dir)
        os.environ.setdefault('PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK', 'True')
        os.environ.setdefault('MODELSCOPE_CACHE', str(settings.BASE_DIR / '.modelscope'))

    def get_language(self):
        return getattr(settings, 'OCR_PADDLE_LANG', DEFAULT_LANGUAGE) or DEFAULT_LANGUAGE

    def get_ocr_version(self):
        return getattr(settings, 'OCR_PADDLE_VERSION', '') or None

    def _validate_configuration(self):
        lang = self.get_language()
        if lang not in SUPPORTED_LANGUAGES:
            from ocr.services import OCREngineConfigurationError

            raise OCREngineConfigurationError(
                f"Idioma PaddleOCR invalido: '{lang}'. Usa 'es' para español o 'en' como fallback compatible."
            )
        return lang, self.get_ocr_version()

    def _load_engine(self):
        self._configure_cache()
        lang, ocr_version = self._validate_configuration()
        cache_key = (lang, ocr_version)
        if cache_key in _ENGINE_CACHE:
            logger.info('PaddleOCR engine reused lang=%s ocr_version=%s', lang, ocr_version or '')
            return _ENGINE_CACHE[cache_key]
        started_at = time.perf_counter()
        logger.info('PaddleOCR engine load started lang=%s ocr_version=%s', lang, ocr_version or '')
        try:
            from paddleocr import PaddleOCR
        except Exception as exc:
            from ocr.services import OCREngineNotAvailable

            raise OCREngineNotAvailable(f'PaddleOCR no esta disponible en el entorno: {exc}')
        kwargs = {
            'lang': lang,
            'use_doc_orientation_classify': False,
            'use_doc_unwarping': False,
            'use_textline_orientation': False,
        }
        if ocr_version:
            kwargs['ocr_version'] = ocr_version
        try:
            engine = PaddleOCR(**kwargs)
        except ValueError as exc:
            from ocr.services import OCREngineConfigurationError

            raise OCREngineConfigurationError(str(exc))
        except Exception as exc:
            if 'paddlepaddle' in str(exc).lower() or "dependency 'paddle" in str(exc).lower():
                from ocr.services import OCREngineNotAvailable

                raise OCREngineNotAvailable(f'PaddleOCR no puede ejecutarse porque falta PaddlePaddle: {exc}')
            from ocr.services import OCREngineConfigurationError

            raise OCREngineConfigurationError(f'PaddleOCR no pudo inicializarse: {exc}')
        _ENGINE_CACHE[cache_key] = engine
        logger.info('PaddleOCR engine loaded lang=%s ocr_version=%s duration_ms=%s', lang, ocr_version or '', int((time.perf_counter() - started_at) * 1000))
        return engine

    def is_available(self):
        self._configure_cache()
        try:
            self._validate_configuration()
        except Exception as exc:
            return False, str(exc)
        try:
            import paddleocr  # noqa: F401
            import paddle  # noqa: F401
            return True, 'PaddleOCR instalado. La primera lectura puede descargar modelos si no existen localmente.'
        except Exception as exc:
            service = self._service_status()
            if service.get('available'):
                return True, 'PaddleOCR disponible via OCR Service.'
            return False, f'PaddleOCR no esta disponible localmente ({exc}) y el OCR Service no esta disponible: {service.get("message", "")}'

    def _service_status(self):
        try:
            from .paddle_service import PaddleServiceProvider

            return PaddleServiceProvider().status()
        except Exception as exc:
            return {'provider': 'paddle', 'available': False, 'message': str(exc)}

    def status(self):
        available, message = self.is_available()
        paddleocr_version = ''
        paddle_version = ''
        try:
            import paddleocr

            paddleocr_version = getattr(paddleocr, '__version__', '')
        except Exception:
            pass
        try:
            import paddle

            paddle_version = getattr(paddle, '__version__', '')
        except Exception:
            pass
        service = self._service_status() if not paddle_version else {}
        return {
            'provider': self.name,
            'available': available,
            'engine': 'PaddleOCR',
            'version': paddleocr_version or service.get('paddleocr_version', '') or service.get('version', ''),
            'language': self.get_language() or service.get('language', ''),
            'ocr_version': self.get_ocr_version() or '',
            'paddle_version': paddle_version or service.get('paddle_version', ''),
            'mode': 'local' if paddle_version else ('service' if service.get('available') else 'unavailable'),
            'message': message,
        }

    def _box_from_points(self, points):
        if not points:
            return None
        xs = [float(point[0]) for point in points]
        ys = [float(point[1]) for point in points]
        return OCRBox(left=min(xs), top=min(ys), width=max(xs) - min(xs), height=max(ys) - min(ys))

    def _iter_results(self, result):
        if result is None:
            return []
        if isinstance(result, dict):
            texts = result.get('rec_texts') or []
            scores = result.get('rec_scores') or []
            boxes = result.get('rec_polys') or result.get('dt_polys') or []
            return list(zip(texts, scores, boxes))
        rows = []
        for page in result:
            if isinstance(page, dict):
                rows.extend(self._iter_results(page))
            elif isinstance(page, list):
                for item in page:
                    if len(item) >= 2:
                        box = item[0]
                        text = item[1][0] if isinstance(item[1], (list, tuple)) else ''
                        score = item[1][1] if isinstance(item[1], (list, tuple)) and len(item[1]) > 1 else None
                        rows.append((text, score, box))
        return rows

    def _words_from_line(self, text, confidence, box):
        parts = str(text).split()
        if not parts:
            return []
        if not box or len(parts) == 1:
            return [OCRWord(text=part, confidence=confidence, box=box) for part in parts]
        total_chars = sum(len(part) for part in parts)
        gap = box.width * 0.02 / max(len(parts) - 1, 1)
        usable_width = max(box.width - gap * (len(parts) - 1), 1)
        cursor = box.left
        words = []
        for index, part in enumerate(parts):
            width = usable_width * (len(part) / total_chars) if total_chars else usable_width / len(parts)
            word_box = OCRBox(left=cursor, top=box.top, width=width, height=box.height)
            words.append(OCRWord(text=part, confidence=confidence, box=word_box))
            cursor += width + gap
        return words

    def extract_document(self, image):
        started_at = time.perf_counter()
        temp_path, image_format, width, height = prepare_image(image)
        try:
            try:
                engine = self._load_engine()
                logger.info('PaddleOCR prediction started image_format=%s width=%s height=%s', image_format, width, height)
                raw_result = engine.predict(temp_path)
            except Exception:
                from .paddle_service import PaddleServiceProvider

                logger.info('Local PaddleOCR unavailable; delegating OCR_PROVIDER=paddle to OCR Service.')
                try:
                    image.seek(0)
                except Exception:
                    pass
                document = PaddleServiceProvider().extract_document(image)
                document.provider = self.name
                document.metadata = {**(document.metadata or {}), 'mode': 'service'}
                return document
        finally:
            cleanup_temp(temp_path)
        lines = []
        words = []
        confidences = []
        for text, score, points in self._iter_results(raw_result):
            if not text:
                continue
            confidence = float(score) * 100 if score is not None and float(score) <= 1 else (float(score) if score is not None else None)
            box = self._box_from_points(points)
            line_words = self._words_from_line(text, confidence, box)
            words.extend(line_words)
            if confidence is not None:
                confidences.append(confidence)
            lines.append(OCRLine(text=str(text), confidence=confidence, box=box, words=line_words))
        raw_text = '\n'.join(line.text for line in lines)
        average = sum(confidences) / len(confidences) if confidences else None
        page = OCRPage(number=1, width=width, height=height, lines=lines)
        duration_ms = int((time.perf_counter() - started_at) * 1000)
        logger.info('PaddleOCR prediction finished lines=%s words=%s confidence=%s duration_ms=%s', len(lines), len(words), average, duration_ms)
        return OCRDocument(raw_text=raw_text, provider=self.name, pages=[page], lines=lines, words=words, confidence=average, metadata={'image_format': image_format, 'processing_time_ms': duration_ms})
