interface CostingMetricCardProps {
  title: string;
  value: string;
  description?: string;
  tone?: 'neutral' | 'green' | 'yellow' | 'red';
}

const tones = {
  neutral: 'border-slate-200 bg-white text-slate-900',
  green: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  yellow: 'border-amber-200 bg-amber-50 text-amber-900',
  red: 'border-red-200 bg-red-50 text-red-900',
};

export function CostingMetricCard({ title, value, description, tone = 'neutral' }: CostingMetricCardProps) {
  return (
    <div className={`rounded-3xl border p-5 shadow-sm ${tones[tone]}`}>
      <p className="text-sm font-medium opacity-70">{title}</p>
      <p className="mt-3 text-2xl font-semibold">{value}</p>
      {description ? <p className="mt-2 text-sm opacity-70">{description}</p> : null}
    </div>
  );
}
