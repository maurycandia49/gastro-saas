import { Link } from 'react-router-dom';
import type { PurchaseImpact } from '../../services/purchases';

export function PurchaseImpactModal({ impact, onClose }: { impact: PurchaseImpact | null; onClose: () => void }) {
  if (!impact) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-xl">
        <h2 className="text-2xl font-semibold text-slate-900">Compra registrada correctamente</h2>
        <p className="mt-2 text-sm text-slate-500">Se actualizo stock, costos y el costeo de productos afectados.</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Insumos</p><p className="text-xl font-semibold">{impact.ingredients_updated.length}</p></div>
          <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Movimientos</p><p className="text-xl font-semibold">{impact.movements_created}</p></div>
          <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Productos afectados</p><p className="text-xl font-semibold">{impact.affected_products_count}</p></div>
        </div>
        <div className="mt-5 max-h-64 space-y-3 overflow-y-auto">
          {impact.ingredients_updated.map((item) => <div key={item.ingredient_id} className="rounded-2xl border border-slate-100 p-3 text-sm"><p className="font-semibold">{item.name}</p><p>Stock: {item.previous_stock} → {item.new_stock} {item.unit}</p><p>Costo: ${item.previous_price} → ${item.new_price} por {item.unit}</p></div>)}
        </div>
        <div className="mt-5 flex flex-wrap justify-end gap-3">
          <Link to="/inventario" className="rounded-2xl border px-4 py-2 text-sm font-semibold">Ver inventario</Link>
          <Link to="/costos" className="rounded-2xl border px-4 py-2 text-sm font-semibold">Ver costos y margenes</Link>
          <button onClick={onClose} className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Cerrar</button>
        </div>
      </div>
    </div>
  );
}
