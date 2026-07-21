import { ShoppingCart } from 'lucide-react';
import { useCart } from '../../contexts/CartContext';

interface CartFloatingButtonProps {
  onOpen: () => void;
  formatPrice: (price: number) => string;
}

export function CartFloatingButton({ onOpen, formatPrice }: CartFloatingButtonProps) {
  const { totalItems, totalPrice } = useCart();

  if (totalItems === 0) return null;

  return (
    <button type="button" onClick={onOpen} className="fixed bottom-5 left-1/2 z-30 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-center justify-between rounded-2xl bg-slate-950 px-5 py-4 text-white shadow-2xl transition hover:bg-slate-900">
      <span className="inline-flex items-center gap-3 text-sm font-semibold">
        <span className="relative">
          <ShoppingCart size={21} />
          <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-400 px-1 text-[11px] font-bold text-slate-950">{totalItems}</span>
        </span>
        Ver carrito
      </span>
      <span className="text-sm font-semibold">{formatPrice(totalPrice)}</span>
    </button>
  );
}
