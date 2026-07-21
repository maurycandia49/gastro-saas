import { Trash2, X } from 'lucide-react';
import type { Product } from '../../services/products';

interface DeleteProductDialogProps {
  product: Product | null;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function DeleteProductDialog({ product, deleting, onCancel, onConfirm }: DeleteProductDialogProps) {
  if (!product) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between">
          <div className="rounded-full bg-rose-50 p-3 text-rose-600"><Trash2 size={20} /></div>
          <button type="button" onClick={onCancel} disabled={deleting} className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 disabled:opacity-60" aria-label="Cerrar confirmacion"><X size={18} /></button>
        </div>
        <h2 className="mt-5 text-xl font-semibold text-slate-900">Eliminar producto</h2>
        <p className="mt-2 text-sm text-slate-500">Vas a eliminar <span className="font-medium text-slate-800">{product.name}</span>. Esta accion no se puede deshacer.</p>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" onClick={onCancel} disabled={deleting} className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-70">Cancelar</button>
          <button type="button" onClick={onConfirm} disabled={deleting} className="rounded-2xl bg-rose-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-rose-700 disabled:opacity-70">{deleting ? 'Eliminando...' : 'Eliminar'}</button>
        </div>
      </div>
    </div>
  );
}
