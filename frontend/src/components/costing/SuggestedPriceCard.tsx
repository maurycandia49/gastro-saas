import type { SuggestedPrice } from '../../services/costing';

interface SuggestedPriceCardProps {
  suggestion: SuggestedPrice | null;
  targetMargin: number;
  onTargetMarginChange: (value: number) => void;
  onApply: () => void;
  applying: boolean;
  formatCurrency: (value: number) => string;
}

export function SuggestedPriceCard({ suggestion, targetMargin, onTargetMarginChange, onApply, applying, formatCurrency }: SuggestedPriceCardProps) {
  return (
    <div className="rounded-3xl border border-slate-200 p-5">
      <label className="block text-sm font-medium text-slate-700">
        Margen objetivo
        <input type="number" min={1} max={99} value={targetMargin} onChange={(event) => onTargetMarginChange(Number(event.target.value))} className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-400" />
      </label>
      {suggestion ? (
        <div className="mt-4 space-y-2 text-sm text-slate-600">
          <p>Precio sugerido: <span className="font-semibold text-slate-900">{formatCurrency(Number(suggestion.suggested_price))}</span></p>
          <p>Diferencia: {formatCurrency(Number(suggestion.price_difference))}</p>
          <p>Ganancia proyectada: {formatCurrency(Number(suggestion.projected_unit_profit))}</p>
          <button type="button" onClick={onApply} disabled={applying} className="mt-3 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60">
            {applying ? 'Aplicando...' : 'Aplicar precio sugerido'}
          </button>
        </div>
      ) : (
        <p className="mt-4 text-sm text-slate-500">Disponible cuando la receta esta completa y tiene costo mayor a cero.</p>
      )}
    </div>
  );
}
