import { Link } from 'react-router-dom';
import type { MetricOrder } from '../../services/metrics';

interface LastOrdersListProps {
  orders: MetricOrder[];
  formatCurrency: (value: number) => string;
  formatTime: (value: string) => string;
}

export function LastOrdersList({ orders, formatCurrency, formatTime }: LastOrdersListProps) {
  if (orders.length === 0) {
    return <div className="rounded-2xl bg-slate-50 p-5 text-center text-sm text-slate-500">Aun no hay pedidos recientes.</div>;
  }

  return (
    <div className="space-y-3">
      {orders.map((order) => (
        <div key={order.id} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900">Pedido #{order.id}</p>
            <p className="truncate text-xs text-slate-500">{order.customer_name} · {formatTime(order.created_at)}</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-slate-900">{formatCurrency(Number(order.total))}</p>
            <p className="text-xs capitalize text-slate-500">{order.status}</p>
          </div>
        </div>
      ))}
      <Link to="/pedidos" className="inline-flex text-sm font-semibold text-slate-900 transition hover:text-slate-600">Ver todos los pedidos</Link>
    </div>
  );
}
