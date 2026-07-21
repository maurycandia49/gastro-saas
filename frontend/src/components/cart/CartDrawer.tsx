import { ShoppingBag, X } from 'lucide-react';
import { useState } from 'react';
import { useCart } from '../../contexts/CartContext';
import { getApiErrorMessage } from '../../services/apiErrors';
import { createPublicOrder, type Order } from '../../services/orders';
import { CartItem } from './CartItem';
import { CheckoutModal, type CheckoutData } from './CheckoutModal';

interface CartDrawerProps {
  open: boolean;
  businessId: number;
  businessPhone: string;
  formatPrice: (price: number) => string;
  onClose: () => void;
}

function cleanPhone(phone: string) {
  return phone.replace(/\D/g, '');
}

function buildWhatsappMessage(data: CheckoutData, order: Order, formatPrice: (price: number) => string) {
  const lines = [
    'Nuevo pedido',
    '',
    `Pedido #${order.id}`,
    '',
    'Cliente:',
    data.name.trim(),
    '',
    'Telefono:',
    data.phone.trim() || 'No informado',
    '',
    'Direccion:',
    data.address.trim(),
    '',
    'Pedido:',
    '',
    ...order.items.map((item) => `${item.quantity} x ${item.product_name}`),
    '',
    'Observaciones:',
    '',
    data.notes.trim() || 'Sin observaciones.',
    '',
    '-----------------------',
    '',
    'TOTAL',
    '',
    formatPrice(Number(order.total)),
    '',
    'Gracias.',
  ];

  return lines.join('\n');
}

export function CartDrawer({ open, businessId, businessPhone, formatPrice, onClose }: CartDrawerProps) {
  const { items, totalItems, totalPrice, incrementItem, decrementItem, removeItem, clearCart } = useCart();
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  const handleCheckoutSubmit = async (data: CheckoutData) => {
    if (submitting) return;

    const phone = cleanPhone(businessPhone);
    if (!phone) {
      setError('Este negocio todavia no tiene telefono configurado para recibir pedidos.');
      setCheckoutOpen(false);
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      const order = await createPublicOrder({
        business_id: businessId,
        customer_name: data.name.trim(),
        customer_phone: data.phone.trim(),
        delivery_address: data.address.trim(),
        notes: data.notes.trim(),
        items: items.map((item) => ({
          product_id: item.product.id,
          quantity: item.quantity,
        })),
      });
      const message = buildWhatsappMessage(data, order, formatPrice);
      const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
      window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
      setCheckoutOpen(false);
      clearCart();
      onClose();
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'No pudimos guardar el pedido. Reintenta en unos segundos.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-slate-950/45" onClick={onClose} />
      <aside className="fixed inset-x-0 bottom-0 z-40 max-h-[88vh] rounded-t-3xl bg-white shadow-2xl transition sm:inset-x-auto sm:bottom-4 sm:right-4 sm:top-4 sm:flex sm:w-[420px] sm:max-h-none sm:flex-col sm:rounded-3xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">Carrito</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-900">{totalItems} productos</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900">
            <X size={20} />
          </button>
        </div>

        <div className="max-h-[48vh] space-y-3 overflow-y-auto p-4 sm:max-h-none sm:flex-1">
          {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
          {items.length === 0 ? (
            <div className="py-10 text-center">
              <ShoppingBag className="mx-auto text-slate-300" size={36} />
              <h3 className="mt-4 text-base font-semibold text-slate-900">Tu carrito esta vacio</h3>
              <p className="mt-2 text-sm text-slate-500">Agrega productos del menu para armar tu pedido.</p>
            </div>
          ) : (
            items.map((item) => (
              <CartItem
                key={item.product.id}
                item={item}
                formatPrice={formatPrice}
                onIncrement={() => incrementItem(item.product.id)}
                onDecrement={() => decrementItem(item.product.id)}
                onRemove={() => removeItem(item.product.id)}
              />
            ))
          )}
        </div>

        <div className="border-t border-slate-100 p-5">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">Total general</span>
            <span className="text-xl font-semibold text-slate-900">{formatPrice(totalPrice)}</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={clearCart} disabled={items.length === 0} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">
              Vaciar carrito
            </button>
            <button type="button" onClick={() => setCheckoutOpen(true)} disabled={items.length === 0} className="rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50">
              Continuar pedido
            </button>
          </div>
        </div>
      </aside>

      <CheckoutModal open={checkoutOpen} submitting={submitting} onClose={() => setCheckoutOpen(false)} onSubmit={(data) => void handleCheckoutSubmit(data)} />
    </>
  );
}
