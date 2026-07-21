import { Loader2, X } from 'lucide-react';
import type { CustomerDetail } from '../../services/customers';

interface CustomerDetailModalProps {
  customer: CustomerDetail | null;
  loading: boolean;
  error: string;
  open: boolean;
  formatCurrency: (value: number) => string;
  formatDateTime: (value: string) => string;
  onClose: () => void;
}

export function CustomerDetailModal({ customer, loading, error, open, formatCurrency, formatDateTime, onClose }: CustomerDetailModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-slate-950/50 p-3 sm:items-center sm:justify-center">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">Cliente</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900">{customer?.name ?? 'Detalle'}</h2>
            {customer ? <p className="mt-1 text-sm text-slate-500">{customer.phone}</p> : null}
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900">
            <X size={20} />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-500">
            <Loader2 className="mr-2 animate-spin" size={20} />
            Cargando cliente...
          </div>
        ) : error ? (
          <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        ) : customer ? (
          <div className="mt-6 space-y-6">
            <div className="grid gap-3 sm:grid-cols-4">
              <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Pedidos</p><p className="mt-2 text-lg font-semibold text-slate-900">{customer.orders_count}</p></div>
              <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Total</p><p className="mt-2 text-lg font-semibold text-slate-900">{formatCurrency(Number(customer.total_spent))}</p></div>
              <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Ticket</p><p className="mt-2 text-lg font-semibold text-slate-900">{formatCurrency(Number(customer.average_ticket))}</p></div>
              <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Frecuencia</p><p className="mt-2 text-lg font-semibold text-slate-900">{customer.frequency_days === null ? '-' : `${customer.frequency_days.toFixed(1)} dias`}</p></div>
            </div>

            <section>
              <h3 className="text-base font-semibold text-slate-900">Productos favoritos</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {customer.favorite_products.length === 0 ? <p className="text-sm text-slate-500">Sin productos registrados.</p> : customer.favorite_products.map((product) => (
                  <span key={product.product_name} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">{product.quantity} x {product.product_name}</span>
                ))}
              </div>
            </section>

            <section>
              <h3 className="text-base font-semibold text-slate-900">Direcciones usadas</h3>
              <div className="mt-3 space-y-2">
                {customer.addresses.map((address) => <p key={address} className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">{address}</p>)}
              </div>
            </section>

            <section>
              <h3 className="text-base font-semibold text-slate-900">Historial de pedidos</h3>
              <div className="mt-3 space-y-3">
                {customer.orders.map((order) => (
                  <div key={order.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Pedido #{order.id}</p>
                      <p className="mt-1 text-xs text-slate-500">{formatDateTime(order.created_at)} · {order.items_count} productos</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-slate-900">{formatCurrency(Number(order.total))}</p>
                      <p className="text-xs capitalize text-slate-500">{order.status}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </div>
  );
}
