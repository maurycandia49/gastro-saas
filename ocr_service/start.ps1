$ErrorActionPreference = "Stop"

$ServiceDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Python = Join-Path $ServiceDir "venv\Scripts\python.exe"
$HostName = if ($env:OCR_HOST) { $env:OCR_HOST } else { "127.0.0.1" }
$Port = if ($env:OCR_PORT) { $env:OCR_PORT } else { "8010" }

if (-not (Test-Path $Python)) {
    Write-Host "No encontre $Python" -ForegroundColor Red
    Write-Host "Crea el entorno del OCR Service con Python 3.12 e instala ocr_service\requirements.txt."
    exit 1
}

Push-Location $ServiceDir
try {
    & $Python -c "import paddle, paddleocr; print('PaddlePaddle', paddle.__version__); print('PaddleOCR', paddleocr.__version__)"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "PaddleOCR no esta instalado en ocr_service\venv." -ForegroundColor Red
        Write-Host "Ejecuta: .\ocr_service\venv\Scripts\python.exe -m pip install -r .\ocr_service\requirements.txt"
        exit 1
    }

    Write-Host "Iniciando Pedilo OCR Service en http://$HostName`:$Port" -ForegroundColor Cyan
    Write-Host "Healthcheck: http://$HostName`:$Port/health"
    & $Python -m uvicorn app:app --host $HostName --port $Port
}
finally {
    Pop-Location
}
