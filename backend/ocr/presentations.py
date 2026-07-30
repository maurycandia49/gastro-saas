import re
import unicodedata
from decimal import Decimal, InvalidOperation


PACKAGE_KEYWORDS = [
    (('bolsa', 'bolson', 'saco'), 'bag', 0.98),
    (('caja', 'cajon'), 'box', 0.98),
    (('pack', 'paquete'), 'pack', 0.98),
    (('bidon', 'bidón'), 'bottle', 0.95),
    (('botella',), 'bottle', 0.98),
    (('lata',), 'can', 0.98),
    (('balde',), 'other', 0.75),
    (('unidad', 'unidades', 'un'), 'unit', 0.9),
]

UNIT_ALIASES = {
    'kg': 'kg',
    'kilo': 'kg',
    'kilos': 'kg',
    'g': 'g',
    'gr': 'g',
    'gramo': 'g',
    'gramos': 'g',
    'l': 'l',
    'lt': 'l',
    'lts': 'l',
    'litro': 'l',
    'litros': 'l',
    'ml': 'ml',
    'mililitro': 'ml',
    'mililitros': 'ml',
    'unidad': 'unidad',
    'unidades': 'unidad',
    'un': 'unidad',
}


def normalize_for_presentation(value):
    value = unicodedata.normalize('NFKD', value or '')
    value = ''.join(char for char in value if not unicodedata.combining(char))
    value = value.lower()
    value = re.sub(r'[^a-z0-9]+', ' ', value)
    return re.sub(r'\s+', ' ', value).strip()


def decimal_or_none(value):
    if value in (None, ''):
        return None
    try:
        return Decimal(str(value).replace(',', '.'))
    except (InvalidOperation, ValueError):
        return None


def money_or_none(value):
    if value in (None, ''):
        return None
    text = str(value).strip()
    if ',' in text and '.' in text:
        text = text.replace('.', '').replace(',', '.')
    else:
        text = text.replace(',', '.')
    try:
        return Decimal(text)
    except (InvalidOperation, ValueError):
        return None


def _fmt(value, places='0.001'):
    if value is None:
        return ''
    quantized = value.quantize(Decimal(places))
    text = format(quantized, 'f')
    return text.rstrip('0').rstrip('.') if '.' in text else text


def infer_package_type(normalized, content_value=None, unit=None):
    for keywords, package_type, confidence in PACKAGE_KEYWORDS:
        if any(keyword in normalized.split() for keyword in keywords):
            return package_type, Decimal(str(confidence))

    if unit in {'kg', 'g'} and content_value and content_value >= Decimal('5'):
        return 'bag', Decimal('0.88')
    if unit == 'l' and content_value and content_value >= Decimal('3'):
        return 'bottle', Decimal('0.82')
    if unit == 'ml':
        return 'bottle', Decimal('0.82')
    if unit == 'unidad' and content_value and content_value > Decimal('1'):
        return 'pack', Decimal('0.75')
    return 'other', Decimal('0.45')


def find_content(text):
    normalized = normalize_for_presentation(text)
    # x25kg, x 25 kg, caja x12, pack x6, bolsa x25kg
    patterns = [
        r'(?:^|\s)x\s*(?P<value>\d+(?:[.,]\d+)?)\s*(?P<unit>kg|kilo|kilos|g|gr|gramos|l|lt|lts|litro|litros|ml|mililitros|unidad|unidades|un)?(?:\s|$)',
        r'(?:^|\s)(?P<value>\d+(?:[.,]\d+)?)\s*(?P<unit>kg|kilo|kilos|g|gr|gramos|l|lt|lts|litro|litros|ml|mililitros|unidad|unidades)(?:\s|$)',
    ]
    for pattern in patterns:
        match = re.search(pattern, normalized)
        if not match:
            continue
        value = decimal_or_none(match.group('value'))
        raw_unit = match.groupdict().get('unit') or ''
        unit = UNIT_ALIASES.get(raw_unit, 'unidad' if pattern.startswith('(?:^|\\s)x') else '')
        if value and unit:
            return value, unit, raw_unit or 'unidad'
    return None, '', ''


def parse_purchase_presentation(description, ocr_quantity, ocr_subtotal, ingredient=None):
    quantity = decimal_or_none(ocr_quantity)
    subtotal = money_or_none(ocr_subtotal)
    content_value, content_unit, original_unit = find_content(description)
    normalized = normalize_for_presentation(description)

    if not quantity or quantity <= 0:
        quantity = Decimal('1')

    if content_value and content_unit:
        package_type, package_confidence = infer_package_type(normalized, content_value, content_unit)
        total_stock_quantity = quantity * content_value
        base_unit_cost = subtotal / total_stock_quantity if subtotal and total_stock_quantity else None
        confidence = min(Decimal('0.98'), package_confidence + Decimal('0.07'))
        return {
            'presentation_type': package_type,
            'package_quantity': _fmt(quantity),
            'content_per_package': _fmt(content_value),
            'content_unit': content_unit,
            'original_content_unit': original_unit,
            'total_stock_quantity': _fmt(total_stock_quantity),
            'base_unit_cost': _fmt(base_unit_cost, '0.01') if base_unit_cost is not None else '',
            'source': 'description_parser',
            'confidence': float(confidence),
            'needs_review': confidence < Decimal('0.80'),
        }

    if ingredient and getattr(ingredient, 'unit', ''):
        total_stock_quantity = quantity
        base_unit_cost = subtotal / total_stock_quantity if subtotal and total_stock_quantity else None
        return {
            'presentation_type': 'unit',
            'package_quantity': _fmt(quantity),
            'content_per_package': '1',
            'content_unit': ingredient.unit,
            'original_content_unit': '',
            'total_stock_quantity': _fmt(total_stock_quantity),
            'base_unit_cost': _fmt(base_unit_cost, '0.01') if base_unit_cost is not None else '',
            'source': 'ingredient_base_unit',
            'confidence': 0.6,
            'needs_review': True,
        }

    return {
        'presentation_type': 'other',
        'package_quantity': _fmt(quantity),
        'content_per_package': '',
        'content_unit': '',
        'original_content_unit': '',
        'total_stock_quantity': '',
        'base_unit_cost': '',
        'source': 'manual_review',
        'confidence': 0.4,
        'needs_review': True,
    }


def strip_presentation_tokens(text):
    normalized = normalize_for_presentation(text)
    normalized = re.sub(r'\bx\s*\d+(?:[.,]\d+)?\s*(kg|kilo|kilos|g|gr|gramos|l|lt|lts|litro|litros|ml|mililitros|unidad|unidades|un)?\b', ' ', normalized)
    normalized = re.sub(r'\b\d+(?:[.,]\d+)?\s*(kg|kilo|kilos|g|gr|gramos|l|lt|lts|litro|litros|ml|mililitros|unidad|unidades)\b', ' ', normalized)
    normalized = re.sub(r'\b(bolsa|bolson|saco|caja|cajon|pack|paquete|bidon|botella|lata|balde|unidad|unidades)\b', ' ', normalized)
    return re.sub(r'\s+', ' ', normalized).strip()
