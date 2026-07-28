from dataclasses import dataclass, field
import re
import unicodedata


@dataclass
class LayoutLine:
    text: str
    left: float = 0
    top: float = 0
    width: float = 0
    height: float = 0
    confidence: float | None = None
    words: list[dict] = field(default_factory=list)
    region: str = 'unknown'


HEADER_TERMS = {
    'codigo', 'cod', 'denominacion', 'descripcion', 'detalle', 'producto',
    'cantidad', 'cant', 'unidad', 'precio', 'unitario', 'p unit', 'importe', 'subtotal',
}
END_TABLE_TERMS = {
    'subtotal general', 'iva', 'impuesto', 'percepcion', 'descuento',
    'bonificacion', 'total', 'cae', 'forma de pago',
}
SUPPLIER_TERMS = {'razon social', 'proveedor', 'emisor'}
BUYER_TERMS = {'cliente', 'comprador', 'senor', 'senores', 'apellido', 'nombre', 'dni'}
ADDRESS_TERMS = {'calle', 'avenida', 'av', 'ruta', 'km', 'piso', 'depto', 'localidad', 'provincia', 'cp', 'codigo postal'}
META_TERMS = {'factura', 'remito', 'ticket', 'fecha', 'cuit', 'dni', 'telefono', 'email'}


def _normalize(value):
    value = (value or '').lower()
    value = unicodedata.normalize('NFKD', value).encode('ascii', 'ignore').decode('ascii')
    value = re.sub(r'[^a-z0-9.,:/\-\s]+', ' ', value)
    return re.sub(r'\s+', ' ', value).strip()


def _line_from_ocr_line(line):
    box = getattr(line, 'box', None)
    words = []
    for word in getattr(line, 'words', []) or []:
        word_box = getattr(word, 'box', None) or box
        words.append({
            'text': getattr(word, 'text', ''),
            'confidence': getattr(word, 'confidence', None),
            'left': getattr(word_box, 'left', 0) if word_box else 0,
            'top': getattr(word_box, 'top', 0) if word_box else 0,
            'width': getattr(word_box, 'width', 0) if word_box else 0,
            'height': getattr(word_box, 'height', 0) if word_box else 0,
        })
    return LayoutLine(
        text=getattr(line, 'text', ''),
        left=getattr(box, 'left', 0) if box else 0,
        top=getattr(box, 'top', 0) if box else 0,
        width=getattr(box, 'width', 0) if box else 0,
        height=getattr(box, 'height', 0) if box else 0,
        confidence=getattr(line, 'confidence', None),
        words=words,
    )


def group_words_into_lines(document):
    raw_lines = [_line_from_ocr_line(line) for line in getattr(document, 'lines', []) if getattr(line, 'text', '')]
    raw_lines.sort(key=lambda item: (item.top, item.left))
    if not raw_lines:
        return []
    grouped = []
    for line in raw_lines:
        if not grouped:
            grouped.append(line)
            continue
        previous = grouped[-1]
        vertical_threshold = max(previous.height, line.height, 12) * 0.65
        if abs(line.top - previous.top) <= vertical_threshold and line.left > previous.left:
            previous.text = f'{previous.text} {line.text}'.strip()
            previous.width = max(previous.left + previous.width, line.left + line.width) - previous.left
            previous.height = max(previous.height, line.height)
            previous.words.extend(line.words)
            confidences = [value for value in [previous.confidence, line.confidence] if value is not None]
            previous.confidence = sum(confidences) / len(confidences) if confidences else None
        else:
            grouped.append(line)
    return grouped


def group_lines_into_blocks(lines):
    blocks = []
    current = []
    previous = None
    for line in lines:
        gap = line.top - (previous.top + previous.height) if previous else 0
        if previous and gap > max(previous.height * 2.2, 28):
            blocks.append(current)
            current = []
        current.append(line)
        previous = line
    if current:
        blocks.append(current)
    return blocks


def detect_columns(lines):
    positions = []
    for line in lines:
        for word in line.words:
            positions.append(word['left'])
    positions.sort()
    columns = []
    for position in positions:
        if not columns or abs(position - columns[-1]) > 35:
            columns.append(position)
    return columns


def _has_any(normalized, terms):
    return any(term in normalized for term in terms)


def detect_product_table(lines):
    header_index = None
    header_score = 0
    for index, line in enumerate(lines):
        normalized = _normalize(line.text)
        terms_found = sum(1 for term in HEADER_TERMS if term in normalized)
        if terms_found >= 3:
            header_index = index
            header_score = min(100, 50 + terms_found * 10)
            line.region = 'items_header'
            break
    if header_index is None:
        return {'detected': False, 'header_index': None, 'start': None, 'end': None, 'confidence': 0, 'columns': []}
    end = len(lines)
    for index in range(header_index + 1, len(lines)):
        normalized = _normalize(lines[index].text)
        if _has_any(normalized, END_TABLE_TERMS):
            end = index
            break
    table_lines = lines[header_index + 1:end]
    columns = detect_columns([lines[header_index], *table_lines])
    for line in table_lines:
        line.region = 'items_table'
    return {'detected': True, 'header_index': header_index, 'start': header_index + 1, 'end': end, 'confidence': header_score, 'columns': columns}


def classify_document_regions(lines):
    table = detect_product_table(lines)
    for index, line in enumerate(lines):
        if line.region in {'items_header', 'items_table'}:
            continue
        normalized = _normalize(line.text)
        if table['detected'] and index >= table['end']:
            line.region = 'totals_block' if _has_any(normalized, END_TABLE_TERMS) else 'footer'
        elif _has_any(normalized, SUPPLIER_TERMS):
            line.region = 'supplier_block'
        elif _has_any(normalized, BUYER_TERMS):
            line.region = 'buyer_block'
        elif _has_any(normalized, ADDRESS_TERMS):
            line.region = 'address_block'
        elif _has_any(normalized, META_TERMS):
            line.region = 'document_metadata'
        elif index <= 3 and not re.search(r'\d', normalized):
            line.region = 'header'
        else:
            line.region = 'unknown'
    return {'lines': lines, 'blocks': group_lines_into_blocks(lines), 'table': table}


def _word_right(word):
    return float(word.get('left', 0)) + float(word.get('width', 0))


def _word_center_x(word):
    return float(word.get('left', 0)) + float(word.get('width', 0)) / 2


def _word_center_y(word):
    return float(word.get('top', 0)) + float(word.get('height', 0)) / 2


def _box_dict(left, top, right, bottom):
    return {'left': left, 'top': top, 'width': right - left, 'height': bottom - top}


def get_document_words(document):
    words = []
    for line in getattr(document, 'lines', []) or []:
        line_box = getattr(line, 'box', None)
        line_words = getattr(line, 'words', []) or []
        if line_words:
            for word in line_words:
                box = getattr(word, 'box', None) or line_box
                text = getattr(word, 'text', '').strip()
                if not box or not text:
                    continue
                words.append({
                    'text': text,
                    'confidence': getattr(word, 'confidence', None),
                    'left': float(getattr(box, 'left', 0)),
                    'top': float(getattr(box, 'top', 0)),
                    'width': float(getattr(box, 'width', 0)),
                    'height': float(getattr(box, 'height', 0)),
                })
        elif line_box and getattr(line, 'text', ''):
            words.append({
                'text': getattr(line, 'text', '').strip(),
                'confidence': getattr(line, 'confidence', None),
                'left': float(getattr(line_box, 'left', 0)),
                'top': float(getattr(line_box, 'top', 0)),
                'width': float(getattr(line_box, 'width', 0)),
                'height': float(getattr(line_box, 'height', 0)),
            })
    return sorted(words, key=lambda word: (word['top'], word['left']))


def group_words_by_visual_rows(words):
    if not words:
        return []
    heights = sorted([word['height'] for word in words if word.get('height')])
    median_height = heights[len(heights) // 2] if heights else 14
    threshold = max(6, median_height * 0.65)
    rows = []
    for word in sorted(words, key=lambda item: (_word_center_y(item), item['left'])):
        center_y = _word_center_y(word)
        best = None
        best_delta = None
        for row in rows:
            delta = abs(center_y - row['center_y'])
            if delta <= threshold and (best_delta is None or delta < best_delta):
                best = row
                best_delta = delta
        if best is None:
            rows.append({'center_y': center_y, 'words': [word]})
        else:
            best['words'].append(word)
            best['center_y'] = sum(_word_center_y(item) for item in best['words']) / len(best['words'])
    result = []
    for row in rows:
        row_words = sorted(row['words'], key=lambda item: item['left'])
        left = min(word['left'] for word in row_words)
        top = min(word['top'] for word in row_words)
        right = max(_word_right(word) for word in row_words)
        bottom = max(word['top'] + word['height'] for word in row_words)
        confidences = [word['confidence'] for word in row_words if word.get('confidence') is not None]
        result.append({
            'text': ' '.join(word['text'] for word in row_words),
            'normalized': _normalize(' '.join(word['text'] for word in row_words)),
            'words': row_words,
            'bbox': _box_dict(left, top, right, bottom),
            'center_y': row['center_y'],
            'confidence': sum(confidences) / len(confidences) if confidences else None,
        })
    return sorted(result, key=lambda row: row['center_y'])


HEADER_ALIASES = {
    'code': {'codigo', 'cod'},
    'description': {'denominacion', 'descripcion', 'detalle', 'producto'},
    'quantity': {'cant', 'cantidad'},
    'unit_price': {'importe', 'precio', 'unitario'},
    'subtotal': {'subtotal'},
}


def _header_hits(row):
    hits = {}
    for word in row['words']:
        normalized = _normalize(word['text'])
        for column, aliases in HEADER_ALIASES.items():
            if normalized in aliases or any(alias in normalized for alias in aliases):
                hits.setdefault(column, []).append(word)
    return hits


def _build_column_boundaries(hits, all_words):
    anchors = []
    for column in ['code', 'description', 'quantity', 'unit_price', 'subtotal']:
        words = hits.get(column) or []
        if words:
            anchors.append((column, min(word['left'] for word in words)))
    anchors.sort(key=lambda item: item[1])
    if len(anchors) < 3:
        return None
    min_left = min(word['left'] for word in all_words)
    max_right = max(_word_right(word) for word in all_words)
    boundaries = {}
    for index, (column, left) in enumerate(anchors):
        next_left = max_right if index == len(anchors) - 1 else anchors[index + 1][1]
        start = min_left - 4 if index == 0 else left
        end = max_right + 4 if index == len(anchors) - 1 else next_left
        boundaries[column] = {'start': start, 'end': end, 'anchor': left}
    return boundaries


def _cell_for_words(words):
    if not words:
        return {'text': '', 'words': [], 'bbox': None, 'confidence': None}
    ordered = sorted(words, key=lambda word: word['left'])
    left = min(word['left'] for word in ordered)
    top = min(word['top'] for word in ordered)
    right = max(_word_right(word) for word in ordered)
    bottom = max(word['top'] + word['height'] for word in ordered)
    confidences = [word['confidence'] for word in ordered if word.get('confidence') is not None]
    return {
        'text': ' '.join(word['text'] for word in ordered).strip(),
        'words': ordered,
        'bbox': _box_dict(left, top, right, bottom),
        'confidence': sum(confidences) / len(confidences) if confidences else None,
    }


def reconstruct_product_table(document):
    words = get_document_words(document)
    rows = group_words_by_visual_rows(words)
    debug = {'headers': [], 'column_boundaries': {}, 'rows': [], 'discarded_rows': [], 'total_row': None}
    if not rows:
        return {'detected': False, 'items': [], 'debug': debug}
    header_index = None
    header_hits = None
    for index, row in enumerate(rows):
        hits = _header_hits(row)
        if len(hits) >= 3:
            header_index = index
            header_hits = hits
            debug['headers'] = [
                {'column': column, 'text': ' '.join(word['text'] for word in hit_words), 'bbox': _cell_for_words(hit_words)['bbox']}
                for column, hit_words in hits.items()
            ]
            break
    if header_index is None:
        debug['discarded_rows'].append({'reason': 'no se detecto fila de encabezados con al menos 3 columnas', 'rows_seen': [row['text'] for row in rows]})
        return {'detected': False, 'items': [], 'debug': debug}
    table_words = [word for row in rows[header_index:] for word in row['words']]
    boundaries = _build_column_boundaries(header_hits, table_words)
    if not boundaries:
        debug['discarded_rows'].append({'reason': 'encabezados insuficientes para calcular limites X'})
        return {'detected': False, 'items': [], 'debug': debug}
    debug['column_boundaries'] = boundaries
    items = []
    for row in rows[header_index + 1:]:
        normalized = row['normalized']
        if any(term in normalized for term in END_TABLE_TERMS):
            debug['total_row'] = {'text': row['text'], 'bbox': row['bbox'], 'reason': 'fin de tabla'}
            break
        cells = {}
        for column, bounds in boundaries.items():
            cell_words = [word for word in row['words'] if bounds['start'] <= _word_center_x(word) < bounds['end']]
            cells[column] = _cell_for_words(cell_words)
        row_debug = {'text': row['text'], 'bbox': row['bbox'], 'cells': cells}
        debug['rows'].append(row_debug)
        required = ['description', 'quantity', 'unit_price', 'subtotal']
        if any(not cells.get(column, {}).get('text') for column in required):
            debug['discarded_rows'].append({'row': row_debug, 'reason': 'faltan celdas obligatorias'})
            continue
        confidences = [cell['confidence'] for cell in cells.values() if cell.get('confidence') is not None]
        items.append({
            'code': cells.get('code', {}).get('text') or None,
            'description': cells['description']['text'],
            'quantity': cells['quantity']['text'],
            'unit_price': cells['unit_price']['text'],
            'subtotal': cells['subtotal']['text'],
            'raw_text': ' | '.join(cells[column]['text'] for column in ['code', 'description', 'quantity', 'unit_price', 'subtotal'] if column in cells),
            'bbox': row['bbox'],
            'cells': cells,
            'confidence': sum(confidences) / len(confidences) if confidences else None,
        })
    return {'detected': bool(items), 'items': items, 'debug': debug, 'header_index': header_index}
