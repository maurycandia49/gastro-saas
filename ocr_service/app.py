from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path
import os
import platform
import tempfile
import time
from typing import Any

from fastapi import FastAPI, File, UploadFile
from fastapi.responses import JSONResponse


BASE_DIR = Path(__file__).resolve().parent
CACHE_DIR = BASE_DIR / "runtime_cache"
PADDLEX_CACHE_DIR = CACHE_DIR / "paddlex"

# Paddle/PaddleX defaults may point to C:\Users\<user>\.cache on Windows.
# In this project that path can be blocked by permissions or OneDrive policy, so
# the OCR service owns its cache explicitly inside ocr_service/.
os.environ["HOME"] = str(BASE_DIR)
os.environ["USERPROFILE"] = str(BASE_DIR)
os.environ["PADDLE_HOME"] = str(CACHE_DIR / "paddle")
os.environ["PADDLEX_HOME"] = str(PADDLEX_CACHE_DIR)
os.environ["PADDLEX_CACHE_DIR"] = str(PADDLEX_CACHE_DIR)
os.environ["PADDLE_PDX_CACHE_HOME"] = str(PADDLEX_CACHE_DIR)
os.environ["PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK"] = "True"
os.environ["PADDLE_PDX_ENABLE_MKLDNN_BYDEFAULT"] = "0"
os.environ["MODELSCOPE_CACHE"] = str(CACHE_DIR / "modelscope")

OCR_LANG = os.getenv("OCR_PADDLE_LANG", "es")
_ENGINE = None
_ENGINE_ERROR = ""
_ENGINE_LOAD_MS: int | None = None


def _box_from_points(points: Any) -> dict[str, float] | None:
    if points is None:
        return None
    try:
        normalized = points.tolist() if hasattr(points, "tolist") else points
        xs = [float(point[0]) for point in normalized]
        ys = [float(point[1]) for point in normalized]
    except Exception:
        return None
    return {
        "left": min(xs),
        "top": min(ys),
        "width": max(xs) - min(xs),
        "height": max(ys) - min(ys),
    }


def _iter_results(result: Any):
    if result is None:
        return []
    if isinstance(result, dict):
        texts = result.get("rec_texts") or []
        scores = result.get("rec_scores") or []
        boxes = result.get("rec_polys") or result.get("dt_polys") or []
        return list(zip(texts, scores, boxes))
    rows = []
    for page in result:
        if isinstance(page, dict):
            rows.extend(_iter_results(page))
        elif isinstance(page, list):
            for item in page:
                if len(item) >= 2:
                    text = item[1][0] if isinstance(item[1], (list, tuple)) else ""
                    score = item[1][1] if isinstance(item[1], (list, tuple)) and len(item[1]) > 1 else None
                    rows.append((text, score, item[0]))
    return rows


def _words_from_line(text: str, confidence: float | None, box: dict[str, float] | None):
    parts = str(text).split()
    if not parts:
        return []
    if not box or len(parts) == 1:
        return [{"text": part, "confidence": confidence, "box": box} for part in parts]
    total_chars = sum(len(part) for part in parts)
    gap = box["width"] * 0.02 / max(len(parts) - 1, 1)
    usable_width = max(box["width"] - gap * (len(parts) - 1), 1)
    cursor = box["left"]
    words = []
    for part in parts:
        width = usable_width * (len(part) / total_chars) if total_chars else usable_width / len(parts)
        words.append({
            "text": part,
            "confidence": confidence,
            "box": {"left": cursor, "top": box["top"], "width": width, "height": box["height"]},
        })
        cursor += width + gap
    return words


def _load_engine():
    global _ENGINE, _ENGINE_ERROR, _ENGINE_LOAD_MS
    if _ENGINE is not None:
        return _ENGINE
    started_at = time.perf_counter()
    try:
        from paddleocr import PaddleOCR

        _ENGINE = PaddleOCR(
            lang=OCR_LANG,
            use_doc_orientation_classify=False,
            use_doc_unwarping=False,
            use_textline_orientation=False,
        )
        _ENGINE_LOAD_MS = int((time.perf_counter() - started_at) * 1000)
        _ENGINE_ERROR = ""
        return _ENGINE
    except Exception as exc:
        _ENGINE_ERROR = str(exc)
        _ENGINE_LOAD_MS = int((time.perf_counter() - started_at) * 1000)
        raise


def _versions():
    paddle_version = ""
    paddleocr_version = ""
    try:
        import paddle

        paddle_version = paddle.__version__
    except Exception:
        pass
    try:
        import paddleocr

        paddleocr_version = paddleocr.__version__
    except Exception:
        pass
    return paddle_version, paddleocr_version


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        _load_engine()
    except Exception:
        pass
    yield


app = FastAPI(title="Pedilo OCR Service", version="1.0.0", lifespan=lifespan)


def health_payload():
    paddle_version, paddleocr_version = _versions()
    available = _ENGINE is not None and not _ENGINE_ERROR
    return {
        "provider": "paddle",
        "status": "ok" if available else "error",
        "available": available,
        "engine": "PaddleOCR",
        "version": paddleocr_version,
        "python_version": platform.python_version(),
        "paddle_version": paddle_version,
        "paddleocr_version": paddleocr_version,
        "language": OCR_LANG,
        "engine_load_ms": _ENGINE_LOAD_MS,
        "message": "PaddleOCR listo." if available else (_ENGINE_ERROR or "PaddleOCR no esta iniciado."),
    }


@app.get("/health")
def health():
    return health_payload()


@app.get("/status")
def status():
    return health_payload()


@app.post("/analyze")
async def analyze(image: UploadFile = File(...)):
    if image.content_type not in {"image/jpeg", "image/png", "image/webp"}:
        return JSONResponse(
            status_code=400,
            content={
                "code": "OCR_INVALID_IMAGE",
                "message": "La imagen no es valida. Usa JPG, PNG o WEBP.",
            },
        )

    try:
        engine = _load_engine()
    except Exception:
        return JSONResponse(
            status_code=503,
            content={
                "code": "OCR_ENGINE_NOT_AVAILABLE",
                "message": "No se pudo iniciar el motor de lectura.",
            },
        )

    suffix = Path(image.filename or "invoice.png").suffix or ".png"
    started_at = time.perf_counter()
    temp_path = ""
    try:
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as temp:
            temp_path = temp.name
            temp.write(await image.read())
        result = engine.predict(temp_path)
    except Exception as exc:
        return JSONResponse(
            status_code=503,
            content={
                "code": "OCR_PROCESSING_FAILED",
                "message": f"No pudimos procesar la factura: {exc}",
            },
        )
    finally:
        if temp_path:
            try:
                os.unlink(temp_path)
            except OSError:
                pass

    lines = []
    words = []
    confidences = []
    for text, score, points in _iter_results(result):
        if not text:
            continue
        confidence = None
        if score is not None:
            raw_score = float(score)
            confidence = raw_score * 100 if raw_score <= 1 else raw_score
            confidences.append(confidence)
        box = _box_from_points(points)
        line_words = _words_from_line(str(text), confidence, box)
        words.extend(line_words)
        lines.append({"text": str(text), "confidence": confidence, "box": box, "words": line_words})

    processing_time_ms = int((time.perf_counter() - started_at) * 1000)
    return {
        "provider": "paddle",
        "raw_text": "\n".join(line["text"] for line in lines),
        "pages": [{"number": 1, "lines_count": len(lines)}],
        "lines": lines,
        "words": words,
        "bounding_boxes": [line["box"] for line in lines if line["box"]],
        "confidence": sum(confidences) / len(confidences) if confidences else None,
        "warnings": [] if lines else ["No se reconocio texto automaticamente."],
        "metadata": {
            "processing_time_ms": processing_time_ms,
            "content_type": image.content_type,
            "language": OCR_LANG,
        },
        "processing_time_ms": processing_time_ms,
    }
