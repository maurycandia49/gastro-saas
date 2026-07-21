import type { CustomerSummary } from '../../services/customers';

interface CustomerCardProps {
  customer: CustomerSummary;
  formatCurrency: (value: number) => string;
  formatDate: (value: string) => string;
  onSelect: () => void;
}

export function CustomerCard({ customer, formatCurrency, formatDate, onSelect }: CustomerCardProps) {
  const badge = customer.is_vip ? 'VIP' : customer.is_recurring ? 'Recurrente' : 'Nuevo';
  const badgeClass = customer.is_vip ? 'bg-emerald-50 text-emerald-700' : customer.is_recurring ? 'bg-sky-50 text-sky-700' : 'bg-slate-100 text-slate-600';

  return (
    <button type="button" onClick={onSelect} className="w-full rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-lg font-semibold text-slate-900">{customer.name}</h3>
          <p className="mt-1 text-sm text-slate-500">{customer.phone}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badgeClass}`}>{badge}</span>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-slate-500">Pedidos</p>
          <p className="mt-1 font-semibold text-slate-900">{customer.orders_count}</p>
        </div>
        <div>
          <p className="text-slate-500">Total gastado</p>
          <p className="mt-1 font-semibold text-slate-900">{formatCurrency(Number(customer.total_spent))}</p>
        </div>
        <div>
          <p className="text-slate-500">Ticket promedio</p>
          <p className="mt-1 font-semibold text-slate-900">{formatCurrency(Number(customer.average_ticket))}</p>
        </div>
        <div>
          <p className="text-slate-500">Ultima compra</p>
          <p className="mt-1 font-semibold text-slate-900">{formatDate(customer.last_order_at)}</p>
        </div>
      </div>
    </button>
  );
}
