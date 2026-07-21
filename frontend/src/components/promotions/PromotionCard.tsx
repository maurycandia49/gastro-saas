import { Edit3, Trash2 } from 'lucide-react';
import type { Promotion } from '../../services/promotions';

export function getPromotionState(promotion: Promotion) {
  const now = Date.now();
  const start = new Date(promotion.starts_at).getTime();
  const end = new Date(promotion.ends_at).getTime();
  if (!promotion.active) return 'inactiva';
  if (start > now) return 'proxima';
  if (end < now) return 'vencida';
  return 'activa';
}

export function PromotionCard({ promotion, onEdit, onToggle, onDelete }: { promotion: Promotion; onEdit: () => void; onToggle: () => void; onDelete: () => void }) {
  const state = getPromotionState(promotion);
  const benefit = promotion.promotion_type === 'percentage' ? `${Number(promotion.percentage_discount).toFixed(0)}% OFF` : `Precio fijo $${Number(promotion.fixed_price).toLocaleString('es-AR')}`;
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{state}</p>
          <h3 className="mt-2 text-lg font-semibold text-slate-900">{promotion.name}</h3>
          <p className="mt-1 text-sm text-slate-500">{promotion.target_name}</p>
        </div>
        {promotion.featured ? <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Destacada</span> : null}
      </div>
      <p className="mt-4 text-2xl font-semibold text-slate-900">{benefit}</p>
      <p className="mt-2 text-sm text-slate-500">{new Date(promotion.starts_at).toLocaleString('es-AR')} - {new Date(promotion.ends_at).toLocaleString('es-AR')}</p>
      <div className="mt-5 flex flex-wrap gap-2">
        <button onClick={onToggle} className="rounded-2xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">{promotion.active ? 'Desactivar' : 'Activar'}</button>
        <button onClick={onEdit} className="inline-flex items-center gap-1 rounded-2xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700"><Edit3 size={14} />Editar</button>
        <button onClick={onDelete} className="inline-flex items-center gap-1 rounded-2xl border border-red-200 px-3 py-2 text-xs font-semibold text-red-600"><Trash2 size={14} />Eliminar</button>
      </div>
    </article>
  );
}
