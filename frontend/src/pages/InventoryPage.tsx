import { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { InventoryCard } from '../components/inventory/InventoryCard';
import { InventoryHistoryModal } from '../components/inventory/InventoryHistoryModal';
import { InventoryMovementModal } from '../components/inventory/InventoryMovementModal';
import { InventorySkeleton } from '../components/inventory/InventorySkeleton';
import { InventoryTable } from '../components/inventory/InventoryTable';
import { Card } from '../components/ui/Card';
import { getApiErrorMessage } from '../services/apiErrors';
import { getBusinesses, type Business } from '../services/business';
import { createIngredient, deleteIngredient, getInventory, getInventoryMovements, getInventorySummary, stockMovement, updateIngredient, type Ingredient, type IngredientPayload, type InventoryMovement, type InventorySummary } from '../services/inventory';

const emptyPayload: IngredientPayload = { negocio: 0, name: '', description: '', sku: '', category: 'otros', unit: 'kg', current_stock: '0.000', minimum_stock: '0.000', purchase_price: '0.00', supplier: '', barcode: '', active: true };

function formatCurrency(value: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);
}

export function InventoryPage() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [businessId, setBusinessId] = useState<number | null>(null);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [summary, setSummary] = useState<InventorySummary | null>(null);
  const [form, setForm] = useState<IngredientPayload>(emptyPayload);
  const [editing, setEditing] = useState<Ingredient | null>(null);
  const [movementIngredient, setMovementIngredient] = useState<Ingredient | null>(null);
  const [movementAction, setMovementAction] = useState<'increase' | 'decrease' | 'adjust'>('increase');
  const [historyIngredient, setHistoryIngredient] = useState<Ingredient | null>(null);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [category, setCategory] = useState('');
  const [lowStock, setLowStock] = useState(false);
  const params = useMemo(() => ({ business: businessId ?? undefined, category: category || undefined, low_stock: lowStock ? 'true' : undefined }), [businessId, category, lowStock]);

  const load = async (selected?: number) => {
    try {
      setLoading(true);
      setError('');
      const businessResponse = businesses.length ? businesses : await getBusinesses();
      if (!businesses.length) setBusinesses(businessResponse);
      const id = selected ?? businessId ?? businessResponse[0]?.id ?? null;
      setBusinessId(id);
      if (id) {
        const [items, stats] = await Promise.all([getInventory({ ...params, business: id }), getInventorySummary({ business: id })]);
        setIngredients(items);
        setSummary(stats);
      }
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'No pudimos cargar inventario.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);
  useEffect(() => { if (businessId) void load(businessId); }, [category, lowStock]);

  const openCreate = () => { setEditing(null); setForm({ ...emptyPayload, negocio: businessId ?? 0 }); setShowForm(true); };
  const openEdit = (ingredient: Ingredient) => { setEditing(ingredient); setForm({ negocio: ingredient.negocio, name: ingredient.name, description: ingredient.description, sku: ingredient.sku, category: ingredient.category, unit: ingredient.unit, current_stock: ingredient.current_stock, minimum_stock: ingredient.minimum_stock, purchase_price: ingredient.purchase_price, supplier: ingredient.supplier, barcode: ingredient.barcode, active: ingredient.active }); setShowForm(true); };
  const saveIngredient = async () => { try { setSaving(true); if (editing) await updateIngredient(editing.id, form); else await createIngredient(form); setShowForm(false); await load(businessId ?? undefined); } catch (requestError) { setError(getApiErrorMessage(requestError, 'No pudimos guardar el insumo.')); } finally { setSaving(false); } };
  const runMovement = async (quantity: string, notes: string) => { if (!movementIngredient) return; try { setSaving(true); await stockMovement(movementIngredient.id, movementAction, quantity, notes); setMovementIngredient(null); await load(businessId ?? undefined); } catch (requestError) { setError(getApiErrorMessage(requestError, 'No pudimos registrar el movimiento.')); } finally { setSaving(false); } };
  const openHistory = async (ingredient: Ingredient) => { setHistoryIngredient(ingredient); setMovements(await getInventoryMovements(ingredient.id)); };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div><p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">Inventario</p><h1 className="mt-2 text-3xl font-semibold text-slate-900">Insumos</h1><p className="mt-2 text-sm text-slate-500">Stock real de insumos del negocio. No stock de productos.</p></div>
        <button onClick={openCreate} className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white"><Plus size={17} />Nuevo insumo</button>
      </div>
      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      <div className="grid gap-4 sm:grid-cols-4"><InventoryCard title="Total insumos" value={String(summary?.total_ingredients ?? 0)} /><InventoryCard title="Valor inventario" value={formatCurrency(Number(summary?.inventory_value ?? 0))} /><InventoryCard title="Stock bajo" value={String(summary?.low_stock ?? 0)} /><InventoryCard title="Movimientos hoy" value={String(summary?.movements_today ?? 0)} /></div>
      <Card><div className="grid gap-3 sm:grid-cols-3">{businesses.length > 1 ? <select value={businessId ?? ''} onChange={(e) => void load(Number(e.target.value))} className="rounded-2xl border px-4 py-3 text-sm">{businesses.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select> : null}<select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-2xl border px-4 py-3 text-sm"><option value="">Todas las categorias</option><option value="lacteos">Lacteos</option><option value="carnes">Carnes</option><option value="verduras">Verduras</option><option value="bebidas">Bebidas</option><option value="harinas">Harinas</option><option value="descartables">Descartables</option><option value="otros">Otros</option></select><label className="flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm"><input type="checkbox" checked={lowStock} onChange={(e) => setLowStock(e.target.checked)} />Solo stock bajo</label></div></Card>
      {loading ? <InventorySkeleton /> : <InventoryTable ingredients={ingredients} formatCurrency={formatCurrency} onEdit={openEdit} onDelete={async (item) => { await deleteIngredient(item.id); await load(businessId ?? undefined); }} onMovement={(item, action) => { setMovementIngredient(item); setMovementAction(action); }} onHistory={(item) => void openHistory(item)} />}
      {showForm ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"><div className="w-full max-w-2xl rounded-2xl bg-white p-6"><h2 className="text-xl font-semibold">{editing ? 'Editar insumo' : 'Nuevo insumo'}</h2><div className="mt-5 grid gap-3 sm:grid-cols-2"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nombre" className="rounded-2xl border px-4 py-3 text-sm" /><input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder="SKU" className="rounded-2xl border px-4 py-3 text-sm" /><select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="rounded-2xl border px-4 py-3 text-sm"><option value="lacteos">Lacteos</option><option value="carnes">Carnes</option><option value="verduras">Verduras</option><option value="bebidas">Bebidas</option><option value="harinas">Harinas</option><option value="descartables">Descartables</option><option value="otros">Otros</option></select><select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value as IngredientPayload['unit'] })} className="rounded-2xl border px-4 py-3 text-sm"><option value="kg">kg</option><option value="g">g</option><option value="l">l</option><option value="ml">ml</option><option value="unidad">unidad</option><option value="docena">docena</option><option value="caja">caja</option><option value="bolsa">bolsa</option><option value="pack">pack</option></select><input value={form.current_stock} onChange={(e) => setForm({ ...form, current_stock: e.target.value })} placeholder="Stock actual" className="rounded-2xl border px-4 py-3 text-sm" /><input value={form.minimum_stock} onChange={(e) => setForm({ ...form, minimum_stock: e.target.value })} placeholder="Stock minimo" className="rounded-2xl border px-4 py-3 text-sm" /><input value={form.purchase_price} onChange={(e) => setForm({ ...form, purchase_price: e.target.value })} placeholder="Costo compra" className="rounded-2xl border px-4 py-3 text-sm" /><input value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} placeholder="Proveedor" className="rounded-2xl border px-4 py-3 text-sm" /></div><div className="mt-5 flex justify-end gap-3"><button onClick={() => setShowForm(false)} className="rounded-2xl border px-4 py-2 text-sm">Cancelar</button><button disabled={saving} onClick={() => void saveIngredient()} className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Guardar</button></div></div></div> : null}
      <InventoryMovementModal ingredient={movementIngredient} action={movementAction} saving={saving} onClose={() => setMovementIngredient(null)} onSubmit={(q, n) => void runMovement(q, n)} />
      <InventoryHistoryModal ingredient={historyIngredient} movements={movements} onClose={() => setHistoryIngredient(null)} />
    </div>
  );
}
