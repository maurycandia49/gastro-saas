import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

import app


class OCRServiceTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app.app)

    def test_status_reports_provider(self):
        response = self.client.get("/status")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["provider"], "paddle")
        self.assertIn("python_version", response.json())

    def test_health_reports_engine(self):
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["engine"], "PaddleOCR")
        self.assertIn("available", response.json())

    def test_invalid_image_returns_controlled_error(self):
        response = self.client.post(
            "/analyze",
            files={"image": ("invoice.txt", b"not-image", "text/plain")},
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["code"], "OCR_INVALID_IMAGE")

    def test_engine_loaded_once(self):
        app._ENGINE = None
        app._ENGINE_ERROR = ""
        created = []

        class FakeEngine:
            def predict(self, path):
                return [{"rec_texts": ["MUZZ BARR 10 kg 100 1000"], "rec_scores": [0.95], "rec_polys": [[[0, 0], [10, 0], [10, 10], [0, 10]]]}]

        with patch("paddleocr.PaddleOCR", side_effect=lambda **kwargs: created.append(kwargs) or FakeEngine()):
            first = app._load_engine()
            second = app._load_engine()

        self.assertIs(first, second)
        self.assertEqual(len(created), 1)


if __name__ == "__main__":
    unittest.main()
