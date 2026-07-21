import { Minus, Plus, Trash2 } from 'lucide-react';
import { type CartItem as CartItemType } from '../../contexts/CartContext';

interface CartItemProps {
  item: CartItemType;
  formatPrice: (price: number) => string;
  onIncrement: () => void;
  onDecrement: () => void;
  onRemove: () => void;
}

export function CartItem({ item, formatPrice, onIncrement, onDecrement, onRemove }: CartItemProps) {
  const subtotal = Number(item.product.price) * item.quantity;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3">
      <div className="flex gap-3">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-slate-100">
          {item.product.image ? <img src={item.product.image} alt={item.product.name} className="h-full w-full object-cover" /> : null}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">{item.product.name}</h3>
              <p className="mt-1 text-xs text-slate-500">{formatPrice(Number(item.product.price))} c/u</p>
            </div>
            <p className="shrink-0 text-sm font-semibold text-slate-900">{formatPrice(subtotal)}</p>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <div className="inline-flex items-center rounded-2xl border border-slate-200">
              <button type="button" onClick={onDecrement} className="p-2 text-slate-600 transition hover:text-slate-950" aria-label="Restar producto">
                <Minus size={16} />
              </button>
              <span className="min-w-8 text-center text-sm font-semibold text-slate-900">{item.quantity}</span>
              <button type="button" onClick={onIncrement} className="p-2 text-slate-600 transition hover:text-slate-950" aria-label="Sumar producto">
                <Plus size={16} />
              </button>
            </div>
            <button type="button" onClick={onRemove} className="inline-flex items-center gap-1 rounded-xl px-2 py-1 text-xs font-semibold text-red-600 transition hover:bg-red-50">
              <Trash2 size={14} />
              Eliminar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
