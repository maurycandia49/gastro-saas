# Pedilo OCR Service

Servicio local de desarrollo para leer comprobantes con PaddleOCR sin instalar Paddle dentro del venv de Django.
Los modelos se guardan en `ocr_service/runtime_cache/` para evitar permisos rotos en caches globales de Windows/OneDrive.

## Requisitos

- Python 3.12 recomendado.
- Dependencias instaladas en `ocr_service/venv`.

## Configuracion

El backend Django debe apuntar al servicio:

```env
OCR_PROVIDER=service
OCR_SERVICE_URL=http://127.0.0.1:8010
OCR_PADDLE_LANG=es
OCR_TIMEOUT_SECONDS=120
```

## Arranque en Windows

Desde la raiz del proyecto:

```powershell
.\ocr_service\start.ps1
```

Healthcheck:

```powershell
Invoke-RestMethod http://127.0.0.1:8010/health
```

## Endpoints

- `GET /health`: estado del motor OCR.
- `GET /status`: alias de compatibilidad.
- `POST /analyze`: recibe `image` multipart y devuelve texto, lineas, palabras, bounding boxes, confianza y metadatos.
