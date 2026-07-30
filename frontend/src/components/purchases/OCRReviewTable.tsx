import type { Ingredient } from '../../services/inventory';
import type { OCRDetectedItem } from '../../services/purchases';
import { IngredientMatcher } from './IngredientMatcher';
import { OCRConfidenceBadge } from './OCRConfidenceBadge';

interface Props {
  items: OCRDetectedItem[];
  ingredients: Ingredient[];
  onChange: (index: number, patch: Partial<OCRDetectedItem>) => void;
  onConfirm: (index: number) => void;
  onIgnore: (index: number) => void;
  onCreateIngredient: (index: number) => void;
  rowErrors?: Record<number, string>;
}

export function OCRReviewTable({ items, ingredients, onChange, onConfirm, onIgnore, onCreateIngredient, rowErrors = {} }: Props) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            <th className="px-3 py-2">Código</th>
            <th className="px-3 py-2">Descripción</th>
            <th className="px-3 py-2">Cantidad OCR</th>
            <th className="px-3 py-2">Precio envase</th>
            <th className="px-3 py-2">Subtotal</th>
            <th className="px-3 py-2">Presentación</th>
            <th className="px-3 py-2">Insumo sugerido</th>
            <th className="px-3 py-2">Confianza</th>
            <th className="px-3 py-2">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map((item, index) => (
            <tr key={`${item.code ?? item.detected_text}-${index}`} className={item.requires_review ? 'bg-amber-50/50' : ''}>
              <td className="px-3 py-3 font-mono text-slate-700">{item.code ?? '—'}</td>
              <td className="min-w-56 px-3 py-3 font-medium text-slate-800">
                {item.description || item.detected_text}
                {item.raw_text && item.raw_text !== item.detected_text ? <p className="mt-1 text-xs font-normal text-slate-400">{item.raw_text}</p> : null}
                {rowErrors[index] ? <p className="mt-2 rounded-lg bg-red-50 px-2 py-1 text-xs font-semibold text-red-700">{rowErrors[index]}</p> : null}
              </td>
              <td className="px-3 py-3"><input value={item.quantity} onChange={(event) => onChange(index, { quantity: event.target.value })} className="w-24 rounded-xl border px-3 py-2" /></td>
              <td className="px-3 py-3"><input value={item.unit_price} onChange={(event) => onChange(index, { unit_price: event.target.value })} className="w-32 rounded-xl border px-3 py-2" /></td>
              <td className="px-3 py-3"><input value={item.subtotal} onChange={(event) => onChange(index, { subtotal: event.target.value })} className="w-32 rounded-xl border px-3 py-2" /></td>
              <td className="min-w-52 px-3 py-3 text-xs text-slate-600">
                {item.package_quantity && item.content_per_package ? (
                  <>
                    <p className="font-semibold text-slate-800">{item.package_quantity} × {item.content_per_package} {item.content_unit}</p>
                    {item.total_stock_quantity ? <p>Ingresan {item.total_stock_quantity} {item.content_unit}</p> : null}
                    {item.base_unit_cost ? <p>Costo real ${item.base_unit_cost}/{item.content_unit}</p> : null}
                  </>
                ) : (
                  <span className="font-semibold text-amber-700">Revisar presentación</span>
                )}
              </td>
              <td className="min-w-56 px-3 py-3">
                <IngredientMatcher value={item.ingredient} ingredients={ingredients} onChange={(ingredientId) => {
                  const selected = ingredients.find((ingredient) => ingredient.id === ingredientId);
                  onChange(index, {
                    ingredient: ingredientId,
                    ingredient_name: selected?.name ?? '',
                    ingredient_unit: selected?.unit ?? item.ingredient_unit,
                    content_unit: selected?.unit ?? item.content_unit,
                    unit: selected?.unit ?? item.unit,
                    requires_review: !ingredientId,
                    confirmed: false,
                    line_status: 'pending',
                    confidence: ingredientId ? Math.max(item.confidence, 90) : item.confidence,
                  });
                }} />
                {!item.ingredient ? <button type="button" onClick={() => onCreateIngredient(index)} className="mt-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">Crear insumo</button> : null}
              </td>
              <td className="px-3 py-3"><OCRConfidenceBadge confidence={item.extraction_confidence ?? item.confidence} /></td>
              <td className="px-3 py-3">
                <div className="flex min-w-40 gap-2">
                  <button
                    type="button"
                    onClick={() => onConfirm(index)}
                    className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {item.confirmed ? 'Línea confirmada' : 'Confirmar línea'}
                  </button>
                  <button
                    type="button"
                    onClick={() => onIgnore(index)}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-white"
                  >
                    Ignorar
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
