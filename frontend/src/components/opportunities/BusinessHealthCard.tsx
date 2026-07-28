import { Link } from 'react-router-dom';
import type { BusinessHealth } from '../../services/opportunities';

const labels: Record<string, string> = {
  sales: 'Ventas',
  profitability: 'Rentabilidad',
  stock: 'Stock',
  operations: 'Operacion',
  configuration: 'Configuracion',
  products: 'Productos',
};

export function BusinessHealthCard({ health }: { health: BusinessHealth }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-500">Salud del negocio</p>
          <div className="mt-3 flex items-end gap-3">
            <p className="text-5xl font-semibold text-slate-900">{health.score}/100</p>
            <p className="pb-2 text-lg font-semibold text-slate-600">{health.label}</p>
          </div>
          <p className="mt-2 text-sm text-slate-500">Podes recuperar {health.points_recoverable} puntos resolviendo acciones concretas.</p>
        </div>
        <div className="h-4 overflow-hidden rounded-full bg-slate-100 lg:w-80">
          <div className="h-full rounded-full bg-slate-900" style={{ width: `${health.score}%` }} />
        </div>
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Object.entries(health.breakdown).map(([key, value]) => (
          <div key={key} className="rounded-2xl bg-slate-50 p-4">
            <p className="text-sm font-medium text-slate-700">{labels[key] ?? key}</p>
            <p className="mt-1 text-sm text-slate-500">Penalizacion: {value} puntos</p>
          </div>
        ))}
      </div>
      {health.actions.length ? (
        <div className="mt-5 space-y-2">
          {health.actions.slice(0, 4).map((action) => (
            <Link key={action.label} to={action.url} className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3 text-sm transition hover:bg-slate-50">
              <span className="font-medium text-slate-800">{action.label}</span>
              <span className="text-emerald-600">+{action.points} pts</span>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
