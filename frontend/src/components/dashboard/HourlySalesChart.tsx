import type { HourlySale } from '../../services/metrics';

interface HourlySalesChartProps {
  data: HourlySale[];
  formatCurrency: (value: number) => string;
}

export function HourlySalesChart({ data, formatCurrency }: HourlySalesChartProps) {
  const maxSales = Math.max(...data.map((item) => Number(item.sales_total)), 0);
  const points = data.map((item, index) => {
    const x = data.length <= 1 ? 0 : (index / (data.length - 1)) * 100;
    const y = maxSales > 0 ? 90 - (Number(item.sales_total) / maxSales) * 75 : 90;
    return `${x},${y}`;
  }).join(' ');

  if (maxSales === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
        Aun no hay ventas registradas hoy.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <svg viewBox="0 0 100 100" className="h-48 w-full overflow-visible" preserveAspectRatio="none">
        <polyline points={points} fill="none" stroke="#0f172a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        {data.map((item, index) => {
          const x = data.length <= 1 ? 0 : (index / (data.length - 1)) * 100;
          const y = maxSales > 0 ? 90 - (Number(item.sales_total) / maxSales) * 75 : 90;
          return Number(item.sales_total) > 0 ? <circle key={item.hour} cx={x} cy={y} r="1.6" fill="#10b981" /> : null;
        })}
      </svg>
      <div className="mt-3 grid grid-cols-4 gap-2 text-xs text-slate-500 sm:grid-cols-6">
        {data.filter((item) => item.hour % 4 === 0).map((item) => (
          <div key={item.hour}>
            <p className="font-medium text-slate-700">{String(item.hour).padStart(2, '0')}:00</p>
            <p>{formatCurrency(Number(item.sales_total))}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
