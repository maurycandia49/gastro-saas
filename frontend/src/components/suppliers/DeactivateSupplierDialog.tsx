import type { Supplier } from '../../services/suppliers';

export function DeactivateSupplierDialog({ supplier, loading, error, onClose, onConfirm }: { supplier: Supplier | null; loading: boolean; error?: string; onClose: () => void; onConfirm: () => void }) {
  if (!supplier) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-xl">
        <h2 className="text-2xl font-semibold text-slate-900">Desactivar proveedor</h2>
        <p className="mt-2 text-sm text-slate-500">Este proveedor dejará de aparecer para nuevas compras, pero se conservará su historial.</p>
        <p className="mt-4 rounded-2xl bg-slate-50 p-3 text-sm font-semibold text-slate-900">{supplier.name}</p>
        {error ? <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
        <div className="mt-6 flex justify-end gap-3">
          <button disabled={loading} onClick={onClose} className="rounded-2xl border px-4 py-2 text-sm disabled:opacity-60">Volver</button>
          <button disabled={loading} onClick={onConfirm} className="rounded-2xl bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{loading ? 'Desactivando...' : 'Desactivar proveedor'}</button>
        </div>
      </div>
    </div>
  );
}
