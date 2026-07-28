from pathlib import Path

from django.core.files import File
from django.core.management.base import BaseCommand, CommandError

from ocr.services import OCRError, extract_text, get_ocr_status


class Command(BaseCommand):
    help = 'Ejecuta OCR local sobre una imagen y muestra diagnostico sin exponer credenciales.'

    def add_arguments(self, parser):
        parser.add_argument('image_path', nargs='?', help='Ruta de una imagen JPG, PNG o WEBP.')

    def handle(self, *args, **options):
        status = get_ocr_status()
        self.stdout.write(f"provider={status['provider']}")
        self.stdout.write(f"available={status['available']}")
        self.stdout.write(f"message={status['message']}")

        image_path = options.get('image_path')
        if not image_path:
            return

        path = Path(image_path)
        if not path.exists():
            raise CommandError(f'No existe la imagen: {path}')

        try:
            with path.open('rb') as handle:
                result = extract_text(image=File(handle))
        except OCRError as exc:
            raise CommandError(f'{exc.code}: {exc.message}')

        self.stdout.write(f"ocr_provider={result['provider']}")
        self.stdout.write(f"metadata={result.get('metadata', {})}")
        self.stdout.write('--- texto reconocido ---')
        self.stdout.write(result['text'])
