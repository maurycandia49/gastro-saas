from django.urls import path

from .views import OCRStatusView

urlpatterns = [
    path('ocr/status/', OCRStatusView.as_view(), name='ocr_status'),
]
