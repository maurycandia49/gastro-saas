import re
import unicodedata
from difflib import SequenceMatcher

from inventory.models import Ingredient
from purchases.models import Supplier
from .models import IngredientAlias
from .presentations import parse_purchase_presentation, strip_presentation_tokens


def normalize_text(value):
    value = unicodedata.normalize('NFKD', value or '')
    value = ''.join(char for char in value if not unicodedata.combining(char))
    value = value.lower()
    value = re.sub(r'[^a-z0-9]+', ' ', value)
    return re.sub(r'\s+', ' ', value).strip()


def _score(left, right):
    if not left or not right:
        return 0
    if left == right:
        return 100
    if left in right or right in left:
        return 92
    return int(SequenceMatcher(None, left, right).ratio() * 100)


def _presentationless(value):
    return strip_presentation_tokens(value) or normalize_text(value)


def match_line_to_ingredient(text, business, supplier=None):
    normalized = normalize_text(text)
    normalized_without_presentation = _presentationless(text)
    supplier_obj = supplier if isinstance(supplier, Supplier) else None

    alias_qs = IngredientAlias.objects.filter(ingredient__negocio=business).select_related('ingredient')
    if supplier_obj:
        alias_qs = alias_qs.filter(supplier__in=[supplier_obj, None])
    best_alias = None
    best_alias_score = 0
    for alias in alias_qs:
        alias_normalized = normalize_text(alias.detected_text)
        alias_without_presentation = _presentationless(alias.detected_text)
        alias_score = max(
            _score(normalized, alias_normalized),
            _score(normalized_without_presentation, alias_without_presentation),
        ) + min(alias.times_confirmed * 2, 8)
        if alias_score > best_alias_score:
            best_alias = alias
            best_alias_score = alias_score
    if best_alias and best_alias_score >= 90:
        return {
            'ingredient': best_alias.ingredient,
            'confidence': min(best_alias_score, 100),
            'strategy': 'alias',
            'requires_review': False,
            'alias': best_alias,
        }

    best_ingredient = None
    best_score = 0
    for ingredient in Ingredient.objects.filter(negocio=business, active=True):
        ingredient_name = normalize_text(ingredient.name)
        ingredient_sku = normalize_text(ingredient.sku)
        current_score = max(
            _score(normalized, ingredient_name),
            _score(normalized_without_presentation, ingredient_name),
            _score(normalized, ingredient_sku),
            _score(normalized_without_presentation, ingredient_sku),
        )
        if current_score > best_score:
            best_score = current_score
            best_ingredient = ingredient

    return {
        'ingredient': best_ingredient if best_score >= 70 else None,
        'confidence': best_score,
        'strategy': 'name_similarity' if best_score >= 70 else 'manual_required',
        'requires_review': best_score < 90,
        'alias': None,
    }


def match_invoice_items(items, business, supplier=None):
    matched = []
    for item in items:
        match = match_line_to_ingredient(item.get('detected_text', ''), business, supplier)
        ingredient = match['ingredient']
        presentation = parse_purchase_presentation(
            item.get('detected_text', ''),
            item.get('quantity'),
            item.get('subtotal'),
            ingredient=ingredient,
        )
        alias = match.get('alias')
        if (
            alias
            and alias.package_type
            and alias.content_per_package
            and alias.content_unit
            and presentation.get('source') != 'description_parser'
        ):
            package_quantity = item.get('quantity') or '1'
            subtotal = item.get('subtotal')
            learned = parse_purchase_presentation(
                f"{item.get('detected_text', '')} x{alias.content_per_package}{alias.content_unit}",
                package_quantity,
                subtotal,
                ingredient=ingredient,
            )
            presentation = {
                **learned,
                'presentation_type': alias.package_type,
                'source': 'learned_alias',
                'confidence': 0.92,
                'needs_review': False,
            }
        extraction_confidence = item.get('confidence')
        requires_review = match['requires_review'] or bool(item.get('needs_review')) or bool(presentation.get('needs_review'))
        matched.append({
            **item,
            'ingredient': ingredient.id if ingredient else None,
            'ingredient_name': ingredient.name if ingredient else '',
            'ingredient_unit': ingredient.unit if ingredient else '',
            'confidence': match['confidence'],
            'extraction_confidence': extraction_confidence,
            'match_strategy': match['strategy'],
            'requires_review': requires_review,
            'presentation': presentation,
            'presentation_type': presentation['presentation_type'],
            'package_quantity': presentation['package_quantity'],
            'content_per_package': presentation['content_per_package'],
            'content_unit': presentation['content_unit'],
            'total_stock_quantity': presentation['total_stock_quantity'],
            'base_unit_cost': presentation['base_unit_cost'],
            'presentation_source': presentation['source'],
            'presentation_confidence': presentation['confidence'],
            'ocr_quantity': item.get('quantity', ''),
            'ocr_unit_price': item.get('unit_price', ''),
            'ocr_subtotal': item.get('subtotal', ''),
            'match': {
                'ingredient': ingredient.id if ingredient else None,
                'ingredient_name': ingredient.name if ingredient else '',
                'confidence': match['confidence'],
                'strategy': match['strategy'],
            },
        })
    return matched
