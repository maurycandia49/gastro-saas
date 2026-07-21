import { useState } from 'react';
import type { Ingredient } from '../../services/inventory';

export function InventoryMovementModal({ ingredient, action, saving, onClose, onSubmit }: { ingredient: Ingredient | null; action: 'increase' | 'decrease' | 'adjust'; saving: boolean; onClose: () => void; onSubmit: (quantity: string, notes: string) => void }) {
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  if (!ingredient) return null;
  const title = action === 'increase' ? 'Aumentar stock' : action === 'decrease' ? 'Disminuir stock' : 'Ajustar stock';
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"><div className="w-full max-w-md rounded-2xl bg-white p-6"><h2 className="text-xl font-semibold">{title}</h2><p className="mt-1 text-sm text-slate-500">{ingredient.name}</p><input value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder={action === 'adjust' ? 'Nuevo stock' : 'Cantidad'} className="mt-5 w-full rounded-2xl border px-4 py-3 text-sm" /><textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Motivo" className="mt-3 w-full rounded-2xl border px-4 py-3 text-sm" /><div className="mt-5 flex justify-end gap-3"><button onClick={onClose} className="rounded-2xl border px-4 py-2 text-sm">Cancelar</button><button disabled={saving} onClick={() => onSubmit(quantity, notes)} className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">Guardar</button></div></div></div>;
}
