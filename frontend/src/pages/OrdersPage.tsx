import { useEffect, useMemo, useState } from 'react';
import { Loader2, PackageOpen, RefreshCw } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { getApiErrorMessage } from '../services/apiErrors';
import { getOrders, updateOrderStatus, type Order, type OrderStatus } from '../services/orders';

const statusOptions: Array<{ value: OrderStatus | ''; label: string }> = [
  { value: '', label: 'Todos' },
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'aceptado', label: 'Aceptado' },
  { value: 'preparando', label: 'Preparando' },
  { value: 'listo', label: 'Listo' },
  { value: 'entregado', label: 'Entregado' },
  { value: 'cancelado', label: 'Cancelado' },
];

const statusStyles: Record<OrderStatus, string> = {
  pendiente: 'bg-amber-50 text-amber-700 border-amber-200',
  aceptado: 'bg-sky-50 text-sky-700 border-sky-200',
  preparando: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  listo: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  entregado: 'bg-slate-100 text-slate-700 border-slate-200',
  cancelado: 'bg-red-50 text-red-700 border-red-200',
};

function formatPrice(price: string) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(Number(price));
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

function getStatusLabel(status: OrderStatus) {
  return statusOptions.find((option) => option.value === status)?.label ?? status;
}

export function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | ''>('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [error, setError] = useState('');

  const filters = useMemo(() => ({ status: statusFilter || undefined }), [statusFilter]);

  const loadOrders = async (soft = false) => {
    try {
      if (soft) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError('');
      const response = await getOrders(filters);
      setOrders(response);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'No pudimos cargar los pedidos.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadOrders();
  }, [filters]);

  const handleStatusChange = async (order: Order, nextStatus: OrderStatus) => {
    try {
      setUpdatingId(order.id);
      setError('');
      const updated = await updateOrderStatus(order.id, nextStatus);
      setOrders((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'No pudimos actualizar el estado del pedido.'));
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">Pedidos</p>
        <h1 className="text-3xl font-semibold text-slate-900">Gestion de pedidos</h1>
        <p className="text-sm text-slate-500">Pedidos reales recibidos desde el menu publico.</p>
      </div>

      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="block sm:w-64">
            <span className="mb-2 block text-sm font-medium text-slate-700">Filtrar por estado</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as OrderStatus | '')} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400">
              {statusOptions.map((option) => <option key={option.value || 'all'} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <button type="button" onClick={() => void loadOrders(true)} disabled={refreshing} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60">
            {refreshing ? <Loader2 className="animate-spin" size={17} /> : <RefreshCw size={17} />}
            Actualizar
          </button>
        </div>
      </Card>

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-32 animate-pulse rounded-2xl bg-slate-100" />)}
        </div>
      ) : orders.length === 0 ? (
        <Card>
          <div className="py-10 text-center">
            <PackageOpen className="mx-auto text-slate-300" size={38} />
            <h2 className="mt-4 text-lg font-semibold text-slate-900">Todavia no hay pedidos</h2>
            <p className="mt-2 text-sm text-slate-500">Cuando un cliente confirme desde el menu publico, va a aparecer aca.</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <article key={order.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold text-slate-900">Pedido #{order.id}</h2>
                    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusStyles[order.status]}`}>{getStatusLabel(order.status)}</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-500">{formatDate(order.created_at)}</p>
                  <p className="mt-3 text-sm font-medium text-slate-900">{order.customer_name}</p>
                  <p className="mt-1 text-sm text-slate-500">{order.delivery_address}</p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[420px]">
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">Total</p>
                    <p className="mt-2 text-base font-semibold text-slate-900">{formatPrice(order.total)}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">Productos</p>
                    <p className="mt-2 text-base font-semibold text-slate-900">{order.items_count}</p>
                  </div>
                  <label className="rounded-2xl bg-slate-50 p-3">
                    <span className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">Estado</span>
                    <select value={order.status} disabled={updatingId === order.id} onChange={(event) => void handleStatusChange(order, event.target.value as OrderStatus)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-slate-400 disabled:opacity-60">
                      {statusOptions.filter((option) => option.value).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </label>
                </div>
              </div>

              <div className="mt-4 border-t border-slate-100 pt-4">
                <div className="flex flex-wrap gap-2">
                  {order.items.map((item) => (
                    <span key={item.id} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                      {item.quantity} x {item.product_name}
                    </span>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
