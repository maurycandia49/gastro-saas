import type { CostBreakdownItem } from '../../services/costing';

interface CostBreakdownProps {
  items: CostBreakdownItem[];
  formatCurrency: (value: number) => string;
}

export function CostBreakdown({ items, formatCurrency }: CostBreakdownProps) {
  if (items.length === 0) {
    return <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">Este producto todavia no tiene receta.</div>;
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.ingredient_id} className="rounded-2xl border border-slate-100 p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-semibold text-slate-900">{item.ingredient_name}</p>
              <p className="mt-1 text-sm text-slate-500">
                {item.recipe_quantity} {item.recipe_unit} · merma {Number(item.waste_percentage).toFixed(1)}% · consume {Number(item.effective_quantity).toFixed(3)} {item.stock_unit}
              </p>
            </div>
            <p className="font-semibold text-slate-900">{formatCurrency(Number(item.calculated_cost))}</p>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-slate-900" style={{ width: `${Math.min(Number(item.percentage_of_total_cost ?? 0), 100)}%` }} />
          </div>
          <p className="mt-2 text-xs text-slate-500">{item.percentage_of_total_cost ?? '0'}% del costo total · costo unitario {formatCurrency(Number(item.purchase_price))}</p>
        </div>
      ))}
    </div>
  );
}
