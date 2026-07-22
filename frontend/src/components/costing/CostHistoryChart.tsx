import type { ProductCost } from '../../services/costing';

interface CostHistoryChartProps {
  snapshots: NonNullable<ProductCost['snapshots']>;
  formatCurrency: (value: number) => string;
}

export function CostHistoryChart({ snapshots, formatCurrency }: CostHistoryChartProps) {
  if (snapshots.length === 0) {
    return <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">Todavia no hay snapshots historicos.</p>;
  }

  const maxCost = Math.max(...snapshots.map((snapshot) => Number(snapshot.recipe_cost)), 1);

  return (
    <div className="space-y-3">
      {snapshots.slice(0, 8).map((snapshot) => (
        <div key={snapshot.id}>
          <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
            <span>{new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(snapshot.calculated_at))}</span>
            <span>{formatCurrency(Number(snapshot.recipe_cost))} · margen {snapshot.margin_percentage ?? '—'}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-indigo-500" style={{ width: `${(Number(snapshot.recipe_cost) / maxCost) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
