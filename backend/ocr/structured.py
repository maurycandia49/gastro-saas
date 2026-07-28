from decimal import Decimal, InvalidOperation


def _decimal(value):
    if value in {None, ''}:
        return None
    cleaned = str(value).strip().replace('$', '').replace('ARS', '').replace(' ', '')
    if ',' in cleaned and '.' in cleaned:
        cleaned = cleaned.replace('.', '').replace(',', '.')
    else:
        cleaned = cleaned.replace(',', '.')
    try:
        return Decimal(cleaned)
    except (InvalidOperation, ValueError):
        return None


def structured_invoice_to_parsed(payload):
    supplier = payload.get('supplier') or {}
    buyer = payload.get('buyer') or {}
    document = payload.get('document') or {}
    warnings = list(payload.get('warnings') or [])
    items = []
    uncertain_lines = []
    line_total = Decimal('0')

    for raw_item in payload.get('items') or []:
        description = (raw_item.get('description') or '').strip()
        quantity = _decimal(raw_item.get('quantity'))
        unit_price = _decimal(raw_item.get('unit_price'))
        subtotal = _decimal(raw_item.get('subtotal'))
        item_warnings = []
        if not description:
            item_warnings.append('descripcion vacia')
        if quantity is None or quantity <= 0:
            item_warnings.append('cantidad invalida')
        if unit_price is None:
            item_warnings.append('precio unitario invalido')
        if subtotal is None:
            item_warnings.append('subtotal invalido')
        if quantity is not None and unit_price is not None and subtotal is not None:
            calculated = quantity * unit_price
            tolerance = max(Decimal('1.00'), abs(subtotal) * Decimal('0.02'))
            if abs(calculated - subtotal) > tolerance:
                item_warnings.append('cantidad por precio no coincide con subtotal')
        confidence = int(raw_item.get('confidence') or 0)
        needs_review = bool(raw_item.get('needs_review')) or bool(item_warnings) or confidence < 85
        raw_text = ' '.join([str(raw_item.get('code') or ''), description]).strip()
        if item_warnings:
            uncertain_lines.append({
                'raw_line': raw_text,
                'normalized_line': raw_text.lower(),
                'classification': 'uncertain_line',
                'confidence': confidence,
                'reason': '; '.join(item_warnings),
                'product_score': confidence,
                'region': 'items_table',
            })
        if description and quantity is not None and unit_price is not None and subtotal is not None:
            line_total += subtotal
            items.append({
                'detected_text': description,
                'raw_text': raw_text,
                'description': description,
                'code': raw_item.get('code'),
                'quantity': str(quantity),
                'unit': raw_item.get('unit') or 'unidad',
                'unit_price': str(unit_price),
                'subtotal': str(subtotal),
                'confidence': confidence,
                'needs_review': needs_review,
                'source_bbox': None,
                'validation_warnings': item_warnings,
            })

    document_total = _decimal(document.get('total'))
    if document_total is not None and items:
        tolerance = max(Decimal('1.00'), abs(document_total) * Decimal('0.03'))
        if abs(line_total - document_total) > tolerance:
            warnings.append('La suma de las lineas no coincide con el total del comprobante.')
            for item in items:
                item['needs_review'] = True

    if not items:
        warnings.append('No pudimos identificar con seguridad la tabla de productos.')

    return {
        'supplier': {
            'name': supplier.get('name') or '',
            'tax_id': supplier.get('tax_id'),
            'address': supplier.get('address') or '',
        },
        'buyer': buyer,
        'document': document,
        'date': document.get('date'),
        'document_number': document.get('number') or '',
        'total': document.get('total') or '',
        'subtotal': document.get('subtotal') or '',
        'taxes': [{'label': 'Impuestos', 'amount': document.get('taxes')}] if document.get('taxes') else [],
        'discounts': [{'label': 'Descuento', 'amount': document.get('discount')}] if document.get('discount') else [],
        'table_detected': bool(items),
        'items': items,
        'uncertain_lines': uncertain_lines,
        'unknown_lines': uncertain_lines,
        'ignored_regions': [],
        'warnings': warnings,
        'debug': {'structured_provider': 'openai_vision', 'line_total': str(line_total)},
    }
