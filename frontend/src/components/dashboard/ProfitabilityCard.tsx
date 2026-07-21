import type { ProfitMetrics, ProfitableProduct } from '../../services/profit';

interface ProfitabilityCardProps {
  metrics: ProfitMetrics | null;
  formatCurrency: (value: number) => string;
  formatPercent: (value: string | null) => string;
}

function marginTone(margin: string | null) {
  if (margin === null) return 'border-slate-200 bg-slate-50 text-slate-600';
  const value = Number(margin);
  if (value >= 50) return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (value >= 25) return 'border-amber-200 bg-amber-50 text-amber-700';
  return 'border-red-200 bg-red-50 text-red-700';
}

function ProductProfitCard({ title, product, formatCurrency, formatPercent }: { title: string; product: ProfitableProduct | null; formatCurrency: (value: number) => string; formatPercent: (value: string | null) => string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">{title}</p>
      {product ? (
        <>
          <p className="mt-3 text-base font-semibold text-slate-900">{product.name}</p>
          <p className="mt-2 text-sm text-slate-500">Ganancia: <span className="font-semibold text-slate-900">{formatCurrency(Number(product.profit))}</span></p>
          <span className={`mt-3 inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${marginTone(product.margin)}`}>Margen {formatPercent(product.margin)}</span>
        </>
      ) : (
        <p className="mt-3 text-sm text-slate-500">Sin costo cargado para calcular margen.</p>
      )}
    </div>
  );
}

export function ProfitabilityCard({ metrics, formatCurrency, formatPercent }: ProfitabilityCardProps) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-2xl bg-slate-50 p-4">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">Ventas</p>
          <p className="mt-2 text-lg font-semibold text-slate-900">{formatCurrency(Number(metrics?.sales ?? 0))}</p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">Costos</p>
          <p className="mt-2 text-lg font-semibold text-slate-900">{formatCurrency(Number(metrics?.costs ?? 0))}</p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">Ganancia</p>
          <p className="mt-2 text-lg font-semibold text-slate-900">{formatCurrency(Number(metrics?.gross_profit ?? 0))}</p>
        </div>
        <div className={`rounded-2xl border p-4 ${marginTone(metrics?.profit_margin ?? null)}`}>
          <p className="text-xs font-medium uppercase tracking-[0.16em]">Margen</p>
          <p className="mt-2 text-lg font-semibold">{formatPercent(metrics?.profit_margin ?? null)}</p>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <ProductProfitCard title="Producto mas rentable" product={metrics?.top_profitable_product ?? null} formatCurrency={formatCurrency} formatPercent={formatPercent} />
        <ProductProfitCard title="Producto menos rentable" product={metrics?.least_profitable_product ?? null} formatCurrency={formatCurrency} formatPercent={formatPercent} />
      </div>
    </div>
  );
}
