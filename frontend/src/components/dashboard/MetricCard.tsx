interface MetricCardProps {
  title: string;
  value: string;
  comparison?: string;
  loading?: boolean;
}

export function MetricCard({ title, value, comparison, loading = false }: MetricCardProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{title}</p>
      {loading ? <div className="mt-4 h-8 w-28 animate-pulse rounded bg-slate-100" /> : <p className="mt-3 text-2xl font-semibold text-slate-900">{value}</p>}
      {comparison ? <p className="mt-2 text-sm font-medium text-emerald-600">{comparison}</p> : <p className="mt-2 text-sm text-slate-400">Sin comparacion disponible</p>}
    </div>
  );
}
