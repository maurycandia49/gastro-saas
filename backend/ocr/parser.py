import re
from datetime import datetime
from decimal import Decimal, InvalidOperation

from .layout import classify_document_regions, group_words_into_lines, reconstruct_product_table


UNITS = {'kg', 'g', 'l', 'ml', 'unidad', 'un', 'docena', 'caja', 'bolsa', 'pack'}
PRODUCT_SCORE_THRESHOLD = 70
UNCERTAIN_SCORE_THRESHOLD = 45
SUPPLIER_WORDS = {'srl', 'sa', 'sas', 'sh', 'distribuidora', 'mayorista', 'supermercado', 'alimentos', 'lacteos', 'lácteos'}
ADDRESS_WORDS = {'av', 'avenida', 'calle', 'ruta', 'km', 'localidad', 'provincia', 'cp', 'tel', 'telefono', 'teléfono', 'email', 'www', 'com.ar', 'piso', 'depto'}
BUYER_WORDS = {'cliente', 'comprador', 'senor', 'señor', 'señores', 'apellido', 'nombre', 'dni', 'consumidor'}
HEADER_WORDS = {'codigo', 'código', 'cod', 'descripcion', 'descripción', 'detalle', 'producto', 'cantidad', 'cant', 'unidad', 'precio', 'unitario', 'importe', 'subtotal'}
TOTAL_WORDS = {'total', 'importe total'}
TAX_WORDS = {'iva', 'iibb', 'percepcion', 'percepción', 'impuesto'}
DISCOUNT_WORDS = {'descuento', 'bonificacion', 'bonificación'}
FOOTER_WORDS = {'cae', 'vto', 'vencimiento', 'gracias', 'original', 'duplicado', 'forma de pago'}
NON_PRODUCT_REGIONS = {'header', 'supplier_block', 'buyer_block', 'address_block', 'document_metadata', 'totals_block', 'footer'}


def _normalize(value):
    value = (value or '').lower()
    value = re.sub(r'[^a-z0-9áéíóúñü$%.,/\- ]+', ' ', value)
    return re.sub(r'\s+', ' ', value).strip()


def _to_decimal(value):
    if value is None:
        return None
    cleaned = str(value).strip().replace('$', '').replace(' ', '')
    if ',' in cleaned and '.' in cleaned:
        cleaned = cleaned.replace('.', '').replace(',', '.')
    else:
        cleaned = cleaned.replace(',', '.')
    try:
        return Decimal(cleaned)
    except (InvalidOperation, ValueError):
        return None


def _money_string(value):
    amount = _to_decimal(value)
    return str(amount) if amount is not None else ''


def _parse_date(text):
    for pattern in [r'(\d{2}/\d{2}/\d{4})', r'(\d{4}-\d{2}-\d{2})', r'(\d{2}-\d{2}-\d{4})']:
        match = re.search(pattern, text)
        if not match:
            continue
        value = match.group(1)
        for fmt in ['%d/%m/%Y', '%Y-%m-%d', '%d-%m-%Y']:
            try:
                return datetime.strptime(value, fmt).date().isoformat()
            except ValueError:
                pass
    return None


def _normalize_unit(unit):
    unit = (unit or '').lower()
    return 'unidad' if unit == 'un' else unit


def _numbers(line):
    return re.findall(r'(?<![A-Za-z])\$?\d[\d\.,]*(?![A-Za-z])', line)


def _has_any(normalized, words):
    for word in words:
        if re.search(rf'(?<![a-z0-9]){re.escape(word)}(?![a-z0-9])', normalized):
            return True
    return False


def _looks_address(normalized):
    return _has_any(normalized, ADDRESS_WORDS) or bool(re.search(r'\b\d{3,5}\b.*\b(cp|localidad|provincia|piso|depto|km)\b', normalized))


def _looks_supplier(normalized, index):
    return index <= 3 and (_has_any(normalized, SUPPLIER_WORDS) or (len(normalized.split()) <= 5 and not _numbers(normalized)))


def _looks_buyer(normalized):
    return _has_any(normalized, BUYER_WORDS)


def _looks_phone_email(normalized):
    return '@' in normalized or bool(re.search(r'\b(?:tel|telefono|teléfono|whatsapp)\b', normalized))


def _looks_document_metadata(normalized):
    return bool(re.search(r'\b(?:factura|remito|ticket|fecha|cuit|dni|cae|nro|numero|nº)\b', normalized))


def _product_score(line, in_product_block=False, previous_description=False, region='unknown'):
    normalized = _normalize(line)
    nums = _numbers(line)
    score = 0
    reasons = []
    if in_product_block or region == 'items_table':
        score += 30
        reasons.append('dentro de tabla de productos')
    if nums:
        score += 10
        reasons.append('tiene numero')
    if len(nums) >= 2:
        score += 20
        reasons.append('tiene precio/importe')
    if len(nums) >= 3:
        score += 25
        reasons.append('tiene cantidad/precio/subtotal')
    if re.search(r'\b(kg|g|l|ml|unidad|un|docena|caja|bolsa|pack)\b', normalized):
        score += 15
        reasons.append('tiene unidad')
    if previous_description and nums:
        score += 20
        reasons.append('continua descripcion partida')
    if _looks_address(normalized):
        score -= 80
        reasons.append('parece direccion/contacto')
    if _looks_buyer(normalized) or (_looks_supplier(normalized, 0) and region in {'header', 'supplier_block', 'buyer_block'}):
        score -= 70
        reasons.append('parece persona/razon social')
    if _looks_phone_email(normalized):
        score -= 60
        reasons.append('parece telefono/email')
    if _looks_document_metadata(normalized):
        score -= 60
        reasons.append('parece dato fiscal/documento/fecha')
    if _has_any(normalized, HEADER_WORDS) and len(nums) < 2:
        score -= 60
        reasons.append('parece encabezado')
    if _has_any(normalized, TOTAL_WORDS | TAX_WORDS | DISCOUNT_WORDS):
        score -= 80
        reasons.append('parece total/impuesto/descuento')
    if region in NON_PRODUCT_REGIONS:
        score -= 70
        reasons.append(f'region no permitida: {region}')
    return score, reasons


def classify_lines(lines, layout_regions=None, table_detected=False):
    layout_regions = layout_regions or ['unknown'] * len(lines)
    classified = []
    product_header_index = None
    product_block_end = None
    for index, raw_line in enumerate(lines):
        normalized = _normalize(raw_line)
        region = layout_regions[index] if index < len(layout_regions) else 'unknown'
        classification = 'unknown'
        confidence = 40
        reason = 'sin regla fuerte'

        if re.search(r'\bcuit\b', normalized):
            classification, confidence, reason = 'tax_id', 95, 'contiene CUIT'
        elif re.search(r'\b(factura|fc|remito|ticket)\b', normalized):
            classification, confidence, reason = 'document_number', 85, 'contiene tipo/numero de comprobante'
        elif _parse_date(raw_line):
            classification, confidence, reason = 'date', 90, 'contiene fecha'
        elif 'subtotal' in normalized:
            classification, confidence, reason = 'subtotal', 92, 'contiene subtotal'
            product_block_end = product_block_end or index
        elif _has_any(normalized, TOTAL_WORDS):
            classification, confidence, reason = 'total', 95, 'contiene total'
            product_block_end = product_block_end or index
        elif _has_any(normalized, TAX_WORDS):
            classification, confidence, reason = 'tax', 90, 'contiene impuesto'
            product_block_end = product_block_end or index
        elif _has_any(normalized, DISCOUNT_WORDS):
            classification, confidence, reason = 'discount', 90, 'contiene descuento'
        elif _has_any(normalized, FOOTER_WORDS):
            classification, confidence, reason = 'footer', 80, 'parece pie administrativo'
        elif _looks_address(normalized) or region == 'address_block':
            classification, confidence, reason = 'supplier_address', 85, 'patron de direccion/contacto'
        elif _looks_buyer(normalized) or region == 'buyer_block':
            classification, confidence, reason = 'buyer', 85, 'patron de comprador/persona'
        elif region == 'items_header' or (sum(1 for word in HEADER_WORDS if re.search(rf'(?<![a-z0-9]){re.escape(word)}(?![a-z0-9])', normalized)) >= 2 and len(_numbers(raw_line)) < 2):
            classification, confidence, reason = 'product_header', 90, 'encabezado de tabla de productos'
            product_header_index = index
        elif _looks_supplier(normalized, index):
            classification, confidence, reason = 'supplier_name', 80, 'primeras lineas/proveedor probable'

        in_block = (table_detected and region == 'items_table') or (product_header_index is not None and index > product_header_index and product_block_end is None)
        score, reasons = _product_score(raw_line, in_block, region=region)
        if classification in {'unknown'} and score >= PRODUCT_SCORE_THRESHOLD:
            classification, confidence, reason = 'product_line', min(score, 95), '; '.join(reasons)
        elif classification == 'unknown' and score >= UNCERTAIN_SCORE_THRESHOLD:
            classification, confidence, reason = 'uncertain_line', score, f'candidato dudoso score {score}: {'; '.join(reasons)}'
        elif classification == 'unknown' and score > 0:
            reason = f'candidato rechazado score {score}: {'; '.join(reasons)}'

        classified.append({
            'raw_line': raw_line,
            'normalized_line': normalized,
            'classification': classification,
            'confidence': confidence,
            'reason': reason,
            'product_score': score,
            'region': region,
        })
    return classified, product_header_index, product_block_end


def _parse_item_line(line):
    numbers = _numbers(line)
    if len(numbers) < 2:
        return None
    unit_match = re.search(r'\b(kg|g|l|ml|unidad|un|docena|caja|bolsa|pack)\b', line, re.I)
    unit = _normalize_unit(unit_match.group(1)) if unit_match else 'unidad'
    quantity_raw = numbers[-3] if len(numbers) >= 3 else numbers[0]
    unit_price_raw = numbers[-2]
    subtotal_raw = numbers[-1]
    description = line
    leading_code = numbers[0] if len(numbers) >= 4 and re.match(rf'^\s*{re.escape(numbers[0])}\b', line) else None
    if leading_code:
        description = re.sub(rf'^\s*{re.escape(leading_code)}\b', ' ', description, count=1)
    for token in reversed(numbers[-3:] if len(numbers) >= 3 else numbers[-2:]):
        description = re.sub(re.escape(token), ' ', description, count=1)
    if unit_match:
        description = re.sub(r'\b(kg|g|l|ml|unidad|un|docena|caja|bolsa|pack)\b', ' ', description, flags=re.I)
    description = re.sub(r'[^A-Za-zÁÉÍÓÚÜáéíóúüÑñ0-9 ]+', ' ', description)
    description = re.sub(r'\s+', ' ', description).strip()
    quantity = _to_decimal(quantity_raw)
    unit_price = _to_decimal(unit_price_raw)
    subtotal = _to_decimal(subtotal_raw)
    if not description or quantity is None or unit_price is None or subtotal is None:
        return None
    return {
        'detected_text': description,
        'raw_text': line,
        'description': description,
        'quantity': str(quantity),
        'unit': unit,
        'unit_price': str(unit_price),
        'subtotal': str(subtotal),
        'confidence': 0,
        'needs_review': True,
        'source_bbox': None,
    }


def _parse_visual_table_items(table):
    items = []
    uncertain = []
    line_total = Decimal('0')
    for row in table.get('items', []):
        quantity = _to_decimal(row.get('quantity'))
        unit_price = _to_decimal(row.get('unit_price'))
        subtotal = _to_decimal(row.get('subtotal'))
        warnings = []
        if quantity is None or quantity <= 0:
            warnings.append('cantidad invalida')
        if unit_price is None:
            warnings.append('precio unitario invalido')
        if subtotal is None:
            warnings.append('subtotal invalido')
        if quantity is not None and unit_price is not None and subtotal is not None:
            calculated = quantity * unit_price
            tolerance = max(Decimal('1.00'), abs(subtotal) * Decimal('0.01'))
            if abs(calculated - subtotal) > tolerance:
                warnings.append('cantidad por importe no coincide con subtotal')
            else:
                line_total += subtotal
        confidence = int(row.get('confidence') or 90)
        item = {
            'detected_text': row['description'],
            'raw_text': row.get('raw_text') or row['description'],
            'description': row['description'],
            'code': row.get('code'),
            'quantity': str(quantity) if quantity is not None else '',
            'unit': 'unidad',
            'unit_price': str(unit_price) if unit_price is not None else '',
            'subtotal': str(subtotal) if subtotal is not None else '',
            'confidence': confidence,
            'needs_review': bool(warnings) or confidence < 85,
            'source_bbox': row.get('bbox'),
            'cells': row.get('cells'),
            'validation_warnings': warnings,
        }
        items.append(item)
        if warnings:
            uncertain.append({
                'raw_line': row.get('raw_text') or row['description'],
                'normalized_line': _normalize(row.get('raw_text') or row['description']),
                'classification': 'uncertain_line',
                'confidence': confidence,
                'reason': '; '.join(warnings),
                'product_score': confidence,
                'region': 'items_table',
                'cells': row.get('cells'),
            })
    return items, uncertain, line_total


def _extract_visual_metadata(text):
    normalized_lines = [line.strip() for line in text.splitlines() if line.strip()]
    supplier_name = ''
    supplier_address = ''
    buyer_name = ''
    buyer_address = ''
    buyer_phone = ''
    document_number = ''
    date = _parse_date(text)
    total = None
    tax_id = None

    for index, line in enumerate(normalized_lines):
        normalized = _normalize(line)
        if not supplier_name and index <= 4 and not _looks_phone_email(normalized) and not _looks_address(normalized) and not _looks_document_metadata(normalized):
            supplier_name = line
        if 'distrib' in normalized and not supplier_name:
            supplier_name = line
        tax_match = re.search(r'(?:CUIT|C\.?U\.?I\.?T\.?)\s*[:\-]?\s*([0-9\-\s]{8,24})', line, re.I)
        if tax_match:
            tax_id = re.sub(r'\s+', '', tax_match.group(1))
        if _looks_phone_email(normalized) and not buyer_phone:
            phone_match = re.search(r'(\+?\d[\d\s\-\(\)]{6,})', line)
            if phone_match:
                buyer_phone = re.sub(r'\D+', '', phone_match.group(1))
        if _looks_address(normalized) and not _looks_phone_email(normalized):
            if buyer_name:
                buyer_address = buyer_address or line
            else:
                supplier_address = supplier_address or line
        if _looks_buyer(normalized):
            buyer_name = re.sub(r'\b(cliente|comprador|senor|señor|senores|señores)\b\s*:?', '', line, flags=re.I).strip(' :-') or line
        doc_match = re.search(r'(?:FACTURA|FC|NRO|NUMERO|Nº|#)\s*[:\-]?\s*([A-Z]?\s*-?\s*\d{1,5}-?\d{1,14}|\d{1,14})', line, re.I)
        if doc_match and not document_number:
            document_number = doc_match.group(1).replace(' ', '')
        if re.search(r'\btotal\b', normalized):
            amount_match = re.search(r'(\$?\d[\d\.,]*)\s*$', line)
            amount = _to_decimal(amount_match.group(1)) if amount_match else None
            if amount is not None:
                total = amount

    return {
        'supplier': {'name': supplier_name, 'tax_id': tax_id, 'address': supplier_address},
        'buyer': {'name': buyer_name, 'address': buyer_address, 'phone': buyer_phone},
        'document_number': document_number,
        'date': date,
        'total': str(total) if total is not None else '',
    }


def parse_visual_table_document(document, layout, text):
    table = reconstruct_product_table(document)
    if not table.get('detected'):
        return None
    metadata = _extract_visual_metadata(text)
    items, uncertain, line_total = _parse_visual_table_items(table)
    warnings = []
    document_total = _to_decimal(metadata.get('total'))
    if document_total is not None and items:
        tolerance = max(Decimal('1.00'), abs(document_total) * Decimal('0.01'))
        if abs(line_total - document_total) > tolerance:
            warnings.append('La suma de subtotales no coincide con el total detectado.')
            for item in items:
                item['needs_review'] = True
    return {
        'supplier': metadata['supplier'],
        'buyer': metadata['buyer'],
        'document': {'number': metadata['document_number'], 'date': metadata['date'], 'total': metadata['total']},
        'date': metadata['date'],
        'document_number': metadata['document_number'],
        'total': metadata['total'],
        'subtotal': str(line_total) if line_total else '',
        'taxes': [],
        'discounts': [],
        'table_detected': True,
        'items': items,
        'uncertain_lines': uncertain,
        'unknown_lines': uncertain,
        'ignored_regions': [],
        'warnings': warnings,
        'debug': {
            'supplier_candidates': [metadata['supplier']],
            'classified_lines': [],
            'product_block_start': layout['table'].get('start'),
            'product_block_end': layout['table'].get('end'),
            'rejected_product_candidates': table['debug'].get('discarded_rows', []),
            'product_score_threshold': PRODUCT_SCORE_THRESHOLD,
            'uncertain_score_threshold': UNCERTAIN_SCORE_THRESHOLD,
            'table': layout.get('table', {}),
            'visual_table': table['debug'],
            'total_detected': metadata['total'],
            'line_total': str(line_total),
        },
    }


def _extract_supplier(classified):
    for item in classified:
        if item['classification'] == 'supplier_name':
            return item['raw_line']
    for item in classified:
        if item['region'] in {'header', 'supplier_block'} and item['classification'] not in {'tax_id', 'document_number', 'date'} and not _looks_address(item['normalized_line']):
            return item['raw_line']
    return classified[0]['raw_line'] if classified else ''


def _extract_buyer(classified):
    for item in classified:
        if item['classification'] == 'buyer':
            return item['raw_line']
    return ''


def _extract_address(classified):
    for item in classified:
        if item['classification'] == 'supplier_address':
            return item['raw_line']
    return ''


def _join_split_product_lines(classified):
    result = []
    index = 0
    while index < len(classified):
        current = classified[index]
        next_item = classified[index + 1] if index + 1 < len(classified) else None
        if current['classification'] in {'unknown', 'uncertain_line'} and len(_numbers(current['raw_line'])) <= 1 and next_item:
            score, _ = _product_score(next_item['raw_line'], True, previous_description=True, region=next_item.get('region', 'unknown'))
            if score >= PRODUCT_SCORE_THRESHOLD and next_item['classification'] in {'uncertain_line', 'product_line'}:
                merged = f"{current['raw_line']} {next_item['raw_line']}"
                parsed = _parse_item_line(merged)
                if parsed:
                    parsed['confidence'] = min(score, 95)
                    parsed['needs_review'] = score < 90
                    result.append((parsed, [current, next_item]))
                    index += 2
                    continue
        if current['classification'] == 'product_line':
            parsed = _parse_item_line(current['raw_line'])
            if parsed:
                parsed['confidence'] = current['confidence']
                parsed['needs_review'] = current['confidence'] < 90
                result.append((parsed, [current]))
        index += 1
    return result


def parse_invoice_text(text, layout_regions=None, table_detected=False, table_info=None):
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    classified, product_start, product_end = classify_lines(lines, layout_regions, table_detected)
    tax_id = None
    document_number = ''
    total = None
    subtotal = None
    taxes = []
    discounts = []

    for item in classified:
        line = item['raw_line']
        tax_match = re.search(r'(?:CUIT|C\.?U\.?I\.?T\.?)\s*[:\-]?\s*([0-9\-\s]{8,24})', line, re.I)
        if tax_match:
            tax_id = re.sub(r'\s+', '', tax_match.group(1))
        doc_match = re.search(r'(?:FACTURA|FC|NRO|NUMERO|Nº|#)\s*[:\-]?\s*([A-Z]?\s*-?\s*\d{3,5}-?\d{4,14})', line, re.I)
        if doc_match and not document_number:
            document_number = doc_match.group(1).replace(' ', '')
        amount_match = re.search(r'(\$?\d[\d\.,]*)\s*$', line)
        if amount_match:
            amount = _to_decimal(amount_match.group(1))
            if item['classification'] == 'total':
                total = amount
            elif item['classification'] == 'subtotal':
                subtotal = amount
            elif item['classification'] == 'tax':
                taxes.append({'label': line, 'amount': str(amount)})
            elif item['classification'] == 'discount':
                discounts.append({'label': line, 'amount': str(amount)})
    product_pairs = _join_split_product_lines(classified)
    items = [pair[0] for pair in product_pairs]
    uncertain = [item for item in classified if item['classification'] == 'uncertain_line']
    ignored_regions = [item for item in classified if item['region'] in NON_PRODUCT_REGIONS or item['classification'] in {'supplier_name', 'supplier_address', 'buyer', 'tax_id', 'document_number', 'date', 'subtotal', 'tax', 'total', 'footer', 'product_header'}]
    warnings = []
    if table_info and not table_info.get('detected'):
        warnings.append('No pudimos identificar con seguridad la tabla de productos.')

    return {
        'supplier': {'name': _extract_supplier(classified), 'tax_id': tax_id, 'address': _extract_address(classified)},
        'buyer': {'name': _extract_buyer(classified), 'address': ''},
        'document': {'number': document_number, 'date': _parse_date(text), 'total': str(total) if total is not None else ''},
        'date': _parse_date(text),
        'document_number': document_number,
        'total': str(total) if total is not None else '',
        'subtotal': str(subtotal) if subtotal is not None else '',
        'taxes': taxes,
        'discounts': discounts,
        'table_detected': bool(table_info.get('detected')) if table_info else table_detected,
        'items': items,
        'uncertain_lines': uncertain,
        'unknown_lines': uncertain,
        'ignored_regions': ignored_regions,
        'warnings': warnings,
        'debug': {
            'supplier_candidates': [item for item in classified if item['classification'] == 'supplier_name'],
            'classified_lines': classified,
            'product_block_start': product_start,
            'product_block_end': product_end,
            'rejected_product_candidates': [item for item in classified if item['classification'] == 'unknown' and item['product_score'] > 0],
            'product_score_threshold': PRODUCT_SCORE_THRESHOLD,
            'uncertain_score_threshold': UNCERTAIN_SCORE_THRESHOLD,
            'table': table_info or {},
        },
    }


def parse_ocr_document(document):
    if getattr(document, 'lines', None):
        if not any(getattr(line, 'box', None) for line in document.lines):
            return parse_invoice_text(getattr(document, 'raw_text', '') or '\n'.join(line.text for line in document.lines if line.text))
        layout_lines = group_words_into_lines(document)
        layout = classify_document_regions(layout_lines)
        ordered = layout['lines']
        text = '\n'.join(line.text for line in ordered if line.text)
        visual = parse_visual_table_document(document, layout, text)
        if visual:
            visual['debug']['has_bounding_boxes'] = True
            visual['debug']['columns'] = visual['debug']['visual_table'].get('column_boundaries', {})
            return visual
        parsed = parse_invoice_text(text, [line.region for line in ordered], layout['table']['detected'], layout['table'])
        parsed['debug']['has_bounding_boxes'] = any(line.left or line.top or line.width or line.height for line in ordered)
        parsed['debug']['columns'] = layout['table'].get('columns', [])
        return parsed
    return parse_invoice_text(getattr(document, 'raw_text', '') or '')
