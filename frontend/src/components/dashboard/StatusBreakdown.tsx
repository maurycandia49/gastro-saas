import type { OrderStatus } from '../../services/orders';

const labels: Record<OrderStatus, string> = {
  pendiente: 'Pendiente',
  aceptado: 'Aceptado',
  preparando: 'Preparando',
  listo: 'Listo',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
};

export function StatusBreakdown({ values }: { values: Record<OrderStatus, number> }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {(Object.keys(labels) as OrderStatus[]).map((status) => (
        <div key={status} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
          <span className="text-sm text-slate-600">{labels[status]}</span>
          <span className="text-sm font-semibold text-slate-900">{values[status] ?? 0}</span>
        </div>
      ))}
    </div>
  );
}
