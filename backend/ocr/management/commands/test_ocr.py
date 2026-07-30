from pathlib import Path
import time

from django.core.files import File
from django.core.management.base import BaseCommand, CommandError

from ocr.parser import parse_ocr_document
from ocr.services import OCRError, extract_document, get_ocr_status


class Command(BaseCommand):
    help = 'Diagnostica OCR con una imagen local y muestra proveedor, tiempos, texto y lineas detectadas.'

    def add_arguments(self, parser):
        parser.add_argument('image_path', help='Ruta de una imagen JPG, PNG o WEBP.')

    def handle(self, *args, **options):
        status = get_ocr_status()
        self.stdout.write(f"provider={status.get('provider')}")
        self.stdout.write(f"available={status.get('available')}")
        self.stdout.write(f"language={status.get('language', '')}")
        self.stdout.write(f"ocr_version={status.get('ocr_version', '')}")
        self.stdout.write(f"engine={status.get('engine', '')}")
        self.stdout.write(f"version={status.get('version', '')}")
        self.stdout.write(f"message={status.get('message')}")

        path = Path(options['image_path'])
        if not path.exists():
            raise CommandError(f'No existe la imagen: {path}')

        started_at = time.perf_counter()
        try:
            with path.open('rb') as handle:
                document = extract_document(image=File(handle))
        except OCRError as exc:
            raise CommandError(f'{exc.code}: {exc.message}')
        except Exception as exc:
            raise CommandError(f'OCR_PROCESSING_FAILED: {exc}')

        ocr_ms = int((time.perf_counter() - started_at) * 1000)
        parsed = parse_ocr_document(document)
        total_ms = int((time.perf_counter() - started_at) * 1000)

        self.stdout.write(f"engine_loaded=true")
        self.stdout.write(f"ocr_provider={document.provider}")
        self.stdout.write(f"ocr_time_ms={ocr_ms}")
        self.stdout.write(f"total_time_ms={total_ms}")
        self.stdout.write(f"lines_detected={len(document.lines)}")
        self.stdout.write(f"items_detected={len(parsed.get('items', []))}")
        self.stdout.write(f"unknown_lines={len(parsed.get('unknown_lines', []))}")
        self.stdout.write('--- texto reconocido ---')
        self.stdout.write(document.raw_text or '(sin texto)')
        self.stdout.write('--- lineas ---')
        for index, line in enumerate(document.lines, start=1):
            confidence = '' if line.confidence is None else f" confidence={line.confidence:.1f}"
            self.stdout.write(f"{index}. {line.text}{confidence}")
