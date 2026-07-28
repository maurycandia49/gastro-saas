from dataclasses import dataclass, field
from typing import Any

from PIL import Image, ImageEnhance, ImageOps, UnidentifiedImageError
import tempfile
import os


@dataclass
class OCRBox:
    left: float
    top: float
    width: float
    height: float


@dataclass
class OCRWord:
    text: str
    confidence: float | None = None
    box: OCRBox | None = None


@dataclass
class OCRLine:
    text: str
    confidence: float | None = None
    box: OCRBox | None = None
    words: list[OCRWord] = field(default_factory=list)


@dataclass
class OCRPage:
    number: int
    width: int | None = None
    height: int | None = None
    lines: list[OCRLine] = field(default_factory=list)


@dataclass
class OCRDocument:
    raw_text: str
    provider: str
    pages: list[OCRPage] = field(default_factory=list)
    lines: list[OCRLine] = field(default_factory=list)
    words: list[OCRWord] = field(default_factory=list)
    confidence: float | None = None
    warnings: list[str] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)


class OCRProvider:
    name = 'base'

    def is_available(self) -> tuple[bool, str]:
        return False, 'Proveedor OCR no implementado.'

    def extract_document(self, image) -> OCRDocument:
        raise NotImplementedError


def prepare_image(image):
    try:
        image.seek(0)
        with Image.open(image) as opened:
            if opened.format not in {'JPEG', 'PNG', 'WEBP'}:
                from ocr.services import OCRInvalidImage

                raise OCRInvalidImage()
            normalized = ImageOps.exif_transpose(opened).convert('RGB')
            if normalized.width < 1200:
                ratio = 1200 / normalized.width
                normalized = normalized.resize((1200, int(normalized.height * ratio)))
            normalized = ImageEnhance.Contrast(normalized).enhance(1.25)
            temp = tempfile.NamedTemporaryFile(suffix='.png', delete=False)
            temp.close()
            normalized.save(temp.name, format='PNG')
            return temp.name, opened.format, normalized.width, normalized.height
    except (UnidentifiedImageError, OSError):
        from ocr.services import OCRInvalidImage

        raise OCRInvalidImage()
    finally:
        try:
            image.seek(0)
        except Exception:
            pass


def cleanup_temp(path):
    try:
        os.unlink(path)
    except OSError:
        pass
