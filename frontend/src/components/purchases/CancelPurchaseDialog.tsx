import { Link } from 'react-router-dom';
import type { Purchase } from '../../services/purchases';

export function CancelPurchaseDialog({ purchase, loading, error, onClose, onConfirm }: { purchase: Purchase | null; loading: boolean; error?: string; onClose: () => void; onConfirm: () => void }) {
  if (!purchase) return null;
  const isDraft = purchase.status === 'draft';
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-xl">
        <h2 className="text-2xl font-semibold text-slate-900">{isDraft ? 'Cancelar borrador' : 'Compra confirmada'}</h2>
        <p className="mt-2 text-sm text-slate-500">{isDraft ? 'Esta compra no modificó stock ni costos. El borrador quedará cancelado.' : 'Esta compra ya impactó en inventario. Para corregirla, realizá un ajuste de stock.'}</p>
        {error ? <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
        <div className="mt-6 flex justify-end gap-3">
          <button disabled={loading} onClick={onClose} className="rounded-2xl border px-4 py-2 text-sm disabled:opacity-60">Volver</button>
          {isDraft ? <button disabled={loading} onClick={onConfirm} className="rounded-2xl bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{loading ? 'Cancelando...' : 'Cancelar borrador'}</button> : <Link to="/inventario" className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Ver inventario</Link>}
        </div>
      </div>
    </div>
  );
}
