@echo off
cd /d "%~dp0ocr_service"
set HOME=%CD%
set USERPROFILE=%CD%
set PADDLE_HOME=%CD%\.cache\paddle
set PADDLEX_HOME=%CD%\.paddlex
set PADDLEX_CACHE_DIR=%CD%\.paddlex
set PADDLE_PDX_CACHE_HOME=%CD%\.paddlex
set PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK=True
set PADDLE_PDX_ENABLE_MKLDNN_BYDEFAULT=0
set MODELSCOPE_CACHE=%CD%\.modelscope
set OCR_PADDLE_LANG=es
venv\Scripts\python.exe -m uvicorn app:app --host 127.0.0.1 --port 8010
