import { Edit3, History, Minus, Plus, SlidersHorizontal, Trash2 } from 'lucide-react';
import type { Ingredient } from '../../services/inventory';

export function InventoryTable({ ingredients, formatCurrency, onEdit, onDelete, onMovement, onHistory }: { ingredients: Ingredient[]; formatCurrency: (value: number) => string; onEdit: (item: Ingredient) => void; onDelete: (item: Ingredient) => void; onMovement: (item: Ingredient, action: 'increase' | 'decrease' | 'adjust') => void; onHistory: (item: Ingredient) => void }) {
  const tone = (item: Ingredient) => {
    const stock = Number(item.current_stock);
    const min = Number(item.minimum_stock);
    if (stock <= min) return 'bg-red-50 text-red-700';
    if (stock <= min * 1.3) return 'bg-amber-50 text-amber-700';
    return 'bg-emerald-50 text-emerald-700';
  };
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.14em] text-slate-500"><tr>{['Nombre', 'Categoria', 'Stock', 'Minimo', 'Costo', 'Proveedor', 'Estado', 'Acciones'].map((h) => <th key={h} className="px-4 py-3">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-100">
          {ingredients.map((item) => (
            <tr key={item.id}>
              <td className="px-4 py-3 font-semibold text-slate-900">{item.name}</td>
              <td className="px-4 py-3 text-slate-600">{item.category}</td>
              <td className="px-4 py-3"><span className={`rounded-full px-3 py-1 text-xs font-semibold ${tone(item)}`}>{item.current_stock} {item.unit}</span></td>
              <td className="px-4 py-3 text-slate-600">{item.minimum_stock}</td>
              <td className="px-4 py-3 text-slate-900">{formatCurrency(Number(item.purchase_price))}</td>
              <td className="px-4 py-3 text-slate-600">{item.supplier || '-'}</td>
              <td className="px-4 py-3">{item.active ? 'Activo' : 'Inactivo'}</td>
              <td className="px-4 py-3"><div className="flex gap-1"><button onClick={() => onMovement(item, 'increase')} className="p-2"><Plus size={15} /></button><button onClick={() => onMovement(item, 'decrease')} className="p-2"><Minus size={15} /></button><button onClick={() => onMovement(item, 'adjust')} className="p-2"><SlidersHorizontal size={15} /></button><button onClick={() => onHistory(item)} className="p-2"><History size={15} /></button><button onClick={() => onEdit(item)} className="p-2"><Edit3 size={15} /></button><button onClick={() => onDelete(item)} className="p-2 text-red-600"><Trash2 size={15} /></button></div></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
