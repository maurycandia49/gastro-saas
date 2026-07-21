import type { Promotion } from '../../services/promotions';

export function DeletePromotionDialog({ promotion, deleting, onCancel, onConfirm }: { promotion: Promotion | null; deleting: boolean; onCancel: () => void; onConfirm: () => void }) {
  if (!promotion) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-xl font-semibold text-slate-900">Eliminar promocion</h2>
        <p className="mt-2 text-sm text-slate-500">Se eliminara {promotion.name}. Esta accion no modifica pedidos historicos.</p>
        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onCancel} disabled={deleting} className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">Cancelar</button>
          <button onClick={onConfirm} disabled={deleting} className="rounded-2xl bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{deleting ? 'Eliminando...' : 'Eliminar'}</button>
        </div>
      </div>
    </div>
  );
}
