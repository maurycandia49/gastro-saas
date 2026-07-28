import re
from difflib import SequenceMatcher

from inventory.models import Ingredient
from purchases.models import Supplier
from .models import IngredientAlias


def normalize_text(value):
    value = (value or '').lower()
    value = re.sub(r'[^a-z0-9áéíóúñ]+', ' ', value)
    return re.sub(r'\s+', ' ', value).strip()


def _score(left, right):
    if not left or not right:
        return 0
    if left == right:
        return 100
    if left in right or right in left:
        return 92
    return int(SequenceMatcher(None, left, right).ratio() * 100)


def match_line_to_ingredient(text, business, supplier=None):
    normalized = normalize_text(text)
    supplier_obj = supplier if isinstance(supplier, Supplier) else None

    alias_qs = IngredientAlias.objects.filter(ingredient__negocio=business).select_related('ingredient')
    if supplier_obj:
        alias_qs = alias_qs.filter(supplier__in=[supplier_obj, None])
    best_alias = None
    best_alias_score = 0
    for alias in alias_qs:
        alias_score = _score(normalized, normalize_text(alias.detected_text)) + min(alias.times_confirmed * 2, 8)
        if alias_score > best_alias_score:
            best_alias = alias
            best_alias_score = alias_score
    if best_alias and best_alias_score >= 90:
        return {
            'ingredient': best_alias.ingredient,
            'confidence': min(best_alias_score, 100),
            'strategy': 'alias',
            'requires_review': False,
        }

    best_ingredient = None
    best_score = 0
    for ingredient in Ingredient.objects.filter(negocio=business, active=True):
        current_score = max(_score(normalized, normalize_text(ingredient.name)), _score(normalized, normalize_text(ingredient.sku)))
        if current_score > best_score:
            best_score = current_score
            best_ingredient = ingredient

    return {
        'ingredient': best_ingredient if best_score >= 70 else None,
        'confidence': best_score,
        'strategy': 'name_similarity' if best_score >= 70 else 'manual_required',
        'requires_review': best_score < 90,
    }


def match_invoice_items(items, business, supplier=None):
    matched = []
    for item in items:
        match = match_line_to_ingredient(item.get('detected_text', ''), business, supplier)
        ingredient = match['ingredient']
        extraction_confidence = item.get('confidence')
        requires_review = match['requires_review'] or bool(item.get('needs_review'))
        matched.append({
            **item,
            'ingredient': ingredient.id if ingredient else None,
            'ingredient_name': ingredient.name if ingredient else '',
            'ingredient_unit': ingredient.unit if ingredient else '',
            'confidence': match['confidence'],
            'extraction_confidence': extraction_confidence,
            'match_strategy': match['strategy'],
            'requires_review': requires_review,
            'match': {
                'ingredient': ingredient.id if ingredient else None,
                'ingredient_name': ingredient.name if ingredient else '',
                'confidence': match['confidence'],
                'strategy': match['strategy'],
            },
        })
    return matched
