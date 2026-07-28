import type { PurchaseItem } from '../../services/purchases';

interface Summary {
  supplierName: string;
  date: string;
  items: PurchaseItem[];
  subtotal: string | number;
  taxes: string | number;
  discounts: string | number;
  total: string | number;
}

function money(value: string | number | undefined) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(Number(value || 0));
}

function itemSummary(item: PurchaseItem) {
  if (item.package_quantity && item.content_per_package && item.total_price) {
    return `${item.package_quantity} ${item.package_type ?? 'envase'} · ${item.content_per_package} ${item.content_unit ?? item.unit} por envase · Total ${money(item.total_price)}`;
  }
  return `Ingresan ${item.quantity} ${item.unit} · Precio ${money(item.unit_price)} · Subtotal ${money(item.subtotal ?? Number(item.quantity || 0) * Number(item.unit_price || 0))}`;
}

export function ConfirmPurchaseDialog({ open, summary, loading, error, onClose, onConfirm }: { open: boolean; summary: Summary | null; loading: boolean; error?: string; onClose: () => void; onConfirm: () => void }) {
  if (!open || !summary) return null;
  const changedCosts = summary.items.filter((item) => item.previous_purchase_price !== undefined || item.new_purchase_price !== undefined);
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-xl">
        <h2 className="text-2xl font-semibold text-slate-900">Confirmar compra</h2>
        <p className="mt-2 text-sm text-slate-500">Esta acción actualizará el stock y el costo de los insumos. La compra no podrá volver a editarse.</p>
        <div className="mt-5 grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm sm:grid-cols-2">
          <p><span className="text-slate-500">Proveedor:</span> <span className="font-semibold">{summary.supplierName}</span></p>
          <p><span className="text-slate-500">Fecha:</span> <span className="font-semibold">{summary.date}</span></p>
          <p><span className="text-slate-500">Líneas:</span> <span className="font-semibold">{summary.items.length}</span></p>
          <p><span className="text-slate-500">Total:</span> <span className="font-semibold">{money(summary.total)}</span></p>
          <p><span className="text-slate-500">Subtotal:</span> {money(summary.subtotal)}</p>
          <p><span className="text-slate-500">Impuestos:</span> {money(summary.taxes)}</p>
          <p><span className="text-slate-500">Descuentos:</span> {money(summary.discounts)}</p>
        </div>
        <div className="mt-4 max-h-56 space-y-2 overflow-y-auto text-sm">
          {summary.items.map((item, index) => (
            <div key={`${item.ingredient}-${index}`} className="rounded-2xl border border-slate-100 p-3">
              <p className="font-semibold text-slate-900">{item.ingredient_name || item.description_snapshot || `Insumo #${item.ingredient}`}</p>
              <p className="text-slate-500">{itemSummary(item)}</p>
              {item.unit_cost_in_stock_unit ? <p className="text-xs text-emerald-700">Costo real: {money(item.unit_cost_in_stock_unit)} por {item.ingredient_unit ?? item.unit}</p> : null}
            </div>
          ))}
          {changedCosts.length ? <p className="rounded-2xl bg-amber-50 p-3 text-amber-800">Hay costos que cambiarán al confirmar esta compra.</p> : null}
        </div>
        {error ? <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
        <div className="mt-6 flex justify-end gap-3">
          <button disabled={loading} onClick={onClose} className="rounded-2xl border px-4 py-2 text-sm disabled:opacity-60">Volver</button>
          <button disabled={loading} onClick={onConfirm} className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{loading ? 'Confirmando...' : 'Confirmar compra'}</button>
        </div>
      </div>
    </div>
  );
}
