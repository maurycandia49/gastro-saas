from datetime import timedelta
from decimal import Decimal
import json
import logging
import re
import time

from django.db.models import F, Sum
from django.db.models.functions import Coalesce
from django.conf import settings
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from negocios.models import Negocio
from ocr.matcher import match_invoice_items
from ocr.parser import parse_ocr_document
from ocr.services import OCRError, extract_document
from ocr.structured import structured_invoice_to_parsed
from .models import Purchase, Supplier
from .serializers import PurchaseSerializer, SupplierSerializer
from .services import confirm_purchase

logger = logging.getLogger(__name__)


def _normalize_supplier_name(value):
    return re.sub(r'[^a-z0-9]+', '', (value or '').lower())


class SupplierViewSet(viewsets.ModelViewSet):
    serializer_class = SupplierSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = Supplier.objects.filter(negocio__user=self.request.user)
        business_id = self.request.query_params.get('business_id')
        active = self.request.query_params.get('active')
        search = self.request.query_params.get('search')
        if business_id:
            queryset = queryset.filter(negocio_id=business_id)
        if active in {'true', 'false'}:
            queryset = queryset.filter(active=active == 'true')
        if search:
            queryset = queryset.filter(name__icontains=search)
        return queryset

    def destroy(self, request, *args, **kwargs):
        supplier = self.get_object()
        if supplier.purchases.exists():
            supplier.active = False
            supplier.save(update_fields=['active', 'updated_at'])
            return Response(SupplierSerializer(supplier).data)
        return super().destroy(request, *args, **kwargs)


class PurchaseViewSet(viewsets.ModelViewSet):
    serializer_class = PurchaseSerializer
    permission_classes = [permissions.IsAuthenticated]

    def _log_purchase_request(self, request, action_name):
        if not settings.DEBUG:
            return
        data = request.data
        items = data.get('items', [])
        parsed_items_count = None
        if isinstance(items, str):
            try:
                parsed_items = json.loads(items)
                parsed_items_count = len(parsed_items) if hasattr(parsed_items, '__len__') else None
            except json.JSONDecodeError:
                parsed_items_count = 'invalid_json'
        else:
            parsed_items_count = len(items) if hasattr(items, '__len__') else 'unknown'
        logger.warning(
            'Purchase %s request received user_id=%s negocio=%s supplier=%s items_type=%s items_count=%s request_data=%s',
            action_name,
            request.user.id,
            data.get('negocio'),
            data.get('supplier'),
            type(items).__name__,
            parsed_items_count,
            data,
        )

    def create(self, request, *args, **kwargs):
        self._log_purchase_request(request, 'create')
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        self._log_purchase_request(request, 'update')
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        self._log_purchase_request(request, 'partial_update')
        return super().partial_update(request, *args, **kwargs)

    def get_queryset(self):
        queryset = Purchase.objects.filter(negocio__user=self.request.user).select_related('supplier', 'confirmed_by').prefetch_related('items__ingredient')
        business_id = self.request.query_params.get('business_id')
        supplier = self.request.query_params.get('supplier')
        status_value = self.request.query_params.get('status')
        date_from = self.request.query_params.get('date_from')
        date_to = self.request.query_params.get('date_to')
        if business_id:
            queryset = queryset.filter(negocio_id=business_id)
        if supplier:
            queryset = queryset.filter(supplier_id=supplier)
        if status_value:
            queryset = queryset.filter(status=status_value)
        if date_from:
            queryset = queryset.filter(purchase_date__gte=date_from)
        if date_to:
            queryset = queryset.filter(purchase_date__lte=date_to)
        return queryset

    def destroy(self, request, *args, **kwargs):
        purchase = self.get_object()
        if purchase.status != Purchase.STATUS_DRAFT:
            return Response({'detail': 'Solo se pueden eliminar compras en borrador.'}, status=status.HTTP_400_BAD_REQUEST)
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=['post'])
    def confirm(self, request, pk=None):
        purchase, impact = confirm_purchase(self.get_object(), request.user)
        return Response({'purchase': PurchaseSerializer(purchase, context={'request': request}).data, 'impact': impact})

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        purchase = self.get_object()
        if purchase.status != Purchase.STATUS_DRAFT:
            return Response({'detail': 'Solo se pueden cancelar compras en borrador.'}, status=status.HTTP_400_BAD_REQUEST)
        purchase.status = Purchase.STATUS_CANCELLED
        purchase.save(update_fields=['status', 'updated_at'])
        return Response(PurchaseSerializer(purchase, context={'request': request}).data)

    @action(detail=False, methods=['get'])
    def summary(self, request):
        business_id = request.query_params.get('business_id')
        queryset = self.get_queryset().filter(status=Purchase.STATUS_CONFIRMED)
        if business_id:
            queryset = queryset.filter(negocio_id=business_id)
        period = request.query_params.get('period', 'month')
        if period == 'month':
            today = timezone.localdate()
            queryset = queryset.filter(purchase_date__gte=today.replace(day=1))
        total_spent = queryset.aggregate(total=Coalesce(Sum('total'), Decimal('0.00')))['total']
        count = queryset.count()
        top_supplier_raw = queryset.values('supplier_id', 'supplier__name').annotate(total=Coalesce(Sum('total'), Decimal('0.00'))).order_by('-total').first()
        top_supplier = None
        if top_supplier_raw:
            top_supplier = {
                'supplier_id': top_supplier_raw['supplier_id'],
                'name': top_supplier_raw['supplier__name'],
                'total': top_supplier_raw['total'],
            }
        top_ingredient_raw = (
            queryset
            .values('items__ingredient_id', 'items__description_snapshot')
            .annotate(total=Coalesce(Sum('items__subtotal'), Decimal('0.00')))
            .order_by('-total')
            .first()
        )
        top_ingredient = None
        if top_ingredient_raw:
            top_ingredient = {
                'ingredient_id': top_ingredient_raw['items__ingredient_id'],
                'name': top_ingredient_raw['items__description_snapshot'],
                'total': top_ingredient_raw['total'],
            }
        spending_by_category = list(
            queryset
            .values(category=F('items__ingredient__category'))
            .annotate(total=Coalesce(Sum('items__subtotal'), Decimal('0.00')))
            .order_by('-total')
        )
        return Response({
            'total_spent': total_spent,
            'purchases_count': count,
            'average_purchase': total_spent / count if count else Decimal('0.00'),
            'top_supplier': top_supplier,
            'top_ingredient_by_spend': top_ingredient,
            'spending_by_category': spending_by_category,
            'recent_purchases': PurchaseSerializer(queryset[:5], many=True, context={'request': request}).data,
        })

    @action(detail=False, methods=['post'], url_path='ocr')
    def ocr(self, request):
        started_at = time.perf_counter()
        business_id = request.data.get('business_id')
        business = Negocio.objects.filter(id=business_id, user=request.user).first()
        if not business:
            return Response({'detail': 'Negocio no encontrado.'}, status=status.HTTP_404_NOT_FOUND)

        image = request.FILES.get('image') or request.FILES.get('document_image')
        raw_text = request.data.get('raw_text', '')
        if settings.DEBUG:
            logger.info(
                'OCR purchase request received business_id=%s has_image=%s image_size=%s content_type=%s has_raw_text=%s',
                business_id,
                bool(image),
                getattr(image, 'size', None),
                getattr(image, 'content_type', None),
                bool(raw_text),
            )
        try:
            document = extract_document(image=image, raw_text=raw_text)
        except OCRError as exc:
            processing_time_ms = int((time.perf_counter() - started_at) * 1000)
            logger.warning('OCR controlled error code=%s business_id=%s duration_ms=%s', exc.code, business_id, processing_time_ms)
            return Response({
                'status': 'error',
                'code': exc.code,
                'message': exc.message,
                'detail': exc.message,
                'details': None,
                'processing_time_ms': processing_time_ms,
                'manual_fallback': 'No pudimos leer esta factura. Podes completar la compra manualmente.',
            }, status=exc.status_code)
        except Exception as exc:
            processing_time_ms = int((time.perf_counter() - started_at) * 1000)
            logger.exception('Unexpected OCR failure business_id=%s duration_ms=%s', business_id, processing_time_ms)
            return Response({
                'status': 'error',
                'code': 'OCR_PROCESSING_FAILED',
                'message': 'No pudimos procesar la factura. Podes completar la compra manualmente.',
                'detail': 'No pudimos procesar la factura. Podes completar la compra manualmente.',
                'details': str(exc) if settings.DEBUG else None,
                'processing_time_ms': processing_time_ms,
                'manual_fallback': 'No pudimos leer esta factura. Podes completar la compra manualmente.',
            }, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        if settings.DEBUG:
            logger.info(
                'OCR extraction finished provider=%s lines=%s raw_text_chars=%s duration_ms=%s',
                document.provider,
                len(document.lines),
                len(document.raw_text or ''),
                int((time.perf_counter() - started_at) * 1000),
            )
        after_ocr_at = time.perf_counter()
        structured_invoice = (document.metadata or {}).get('structured_invoice')
        parsed = structured_invoice_to_parsed(structured_invoice) if structured_invoice else parse_ocr_document(document)
        after_parse_at = time.perf_counter()

        supplier = None
        supplier_data = parsed['supplier']
        if supplier_data.get('tax_id'):
            supplier = Supplier.objects.filter(negocio=business, tax_id=supplier_data['tax_id']).first()
        if not supplier and supplier_data.get('name'):
            supplier = Supplier.objects.filter(negocio=business, name__iexact=supplier_data['name']).first()
        if not supplier and supplier_data.get('name'):
            wanted = _normalize_supplier_name(supplier_data['name'])
            supplier = next((row for row in Supplier.objects.filter(negocio=business, active=True) if _normalize_supplier_name(row.name) == wanted), None)

        matched_items = match_invoice_items(parsed['items'], business, supplier)
        after_match_at = time.perf_counter()
        review_count = len([item for item in matched_items if item['requires_review']])
        warnings = list(document.warnings)
        for warning in parsed.get('warnings', []):
            if warning not in warnings:
                warnings.append(warning)
        if supplier_data.get('name') and not supplier:
            warnings.append(f'Proveedor detectado "{supplier_data.get("name")}" no existe todavia. Puedes crearlo o seleccionarlo manualmente.')
        if not document.raw_text:
            warnings.append('No se reconocio texto automaticamente. Puedes cargar la compra manualmente.')
        processing_time_ms = int((time.perf_counter() - started_at) * 1000)
        if settings.DEBUG:
            logger.info(
                'OCR response ready business_id=%s items=%s review=%s unknown=%s duration_ms=%s',
                business_id,
                len(matched_items),
                review_count,
                len(parsed.get('unknown_lines', [])),
                processing_time_ms,
            )

        return Response({
            'status': 'success',
            'provider': document.provider,
            'supplier': {
                'id': supplier.id if supplier else None,
                'name': supplier.name if supplier else supplier_data.get('name', ''),
                'tax_id': supplier.tax_id if supplier else supplier_data.get('tax_id'),
                'address': supplier_data.get('address', ''),
            },
            'buyer': parsed.get('buyer', {}),
            'document': parsed.get('document', {}),
            'table_detected': parsed.get('table_detected', False),
            'date': parsed['date'],
            'document_type': Purchase.DOC_INVOICE,
            'document_number': parsed['document_number'],
            'total': parsed['total'],
            'items': matched_items,
            'confidence': 100 if matched_items and review_count == 0 else max(0, 100 - review_count * 15),
            'summary': {
                'items_found': len(matched_items),
                'items_requiring_review': review_count,
            },
            'warnings': warnings,
            'uncertain_lines': parsed.get('uncertain_lines', []),
            'ignored_regions': parsed.get('ignored_regions', []),
            'unresolved_lines': parsed.get('unknown_lines', []),
            'processing_time_ms': processing_time_ms,
            'ocr_provider': document.provider,
            'raw_text': document.raw_text,
            'metadata': document.metadata,
            'unknown_lines': parsed.get('unknown_lines', []),
            **({'debug': {**parsed.get('debug', {}), 'timing_ms': {
                'ocr': int((after_ocr_at - started_at) * 1000),
                'layout_and_parsing': int((after_parse_at - after_ocr_at) * 1000),
                'matching': int((after_match_at - after_parse_at) * 1000),
                'total': processing_time_ms,
            }}} if settings.DEBUG else {}),
        })
