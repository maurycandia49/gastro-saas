import { X } from 'lucide-react';
import type { IngredientCostImpact } from '../../services/costing';

interface IngredientCostImpactModalProps {
  impact: IngredientCostImpact | null;
  onClose: () => void;
  formatCurrency: (value: number) => string;
}

export function IngredientCostImpactModal({ impact, onClose, formatCurrency }: IngredientCostImpactModalProps) {
  if (!impact) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-slate-950/40 p-0 backdrop-blur-sm md:items-center md:justify-center md:p-6">
      <div className="w-full rounded-t-3xl bg-white p-6 shadow-2xl md:max-w-2xl md:rounded-3xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-500">Impacto de costo</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900">{impact.ingredient.name}</h2>
            <p className="mt-1 text-sm text-slate-500">
              {impact.previous_price ? `${formatCurrency(Number(impact.previous_price))} → ` : ''}
              {formatCurrency(Number(impact.current_price))}
              {impact.variation_percentage ? ` · ${Number(impact.variation_percentage) > 0 ? '+' : ''}${Number(impact.variation_percentage).toFixed(1)}%` : ''}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100">
            <X size={20} />
          </button>
        </div>
        <p className="mt-5 text-sm text-slate-600">Esto afecto {impact.affected_products.length} productos.</p>
        <div className="mt-4 max-h-80 space-y-3 overflow-y-auto">
          {impact.affected_products.map((product) => (
            <div key={product.product_id} className="rounded-2xl border border-slate-100 p-4">
              <p className="font-semibold text-slate-900">{product.name}</p>
              <p className="mt-1 text-sm text-slate-500">
                Margen {product.previous_margin ?? '—'}% → {product.current_margin ?? '—'}%
                {product.margin_points_lost ? ` · perdio ${product.margin_points_lost} puntos` : ''}
              </p>
              <p className="mt-1 text-sm text-slate-500">Costo actual: {formatCurrency(Number(product.current_cost))}</p>
            </div>
          ))}
        </div>
        <button type="button" onClick={onClose} className="mt-5 w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white">
          Cerrar
        </button>
      </div>
    </div>
  );
}
