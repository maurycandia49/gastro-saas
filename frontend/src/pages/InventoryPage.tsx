import { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { IngredientCostImpactModal } from '../components/costing/IngredientCostImpactModal';
import { InventoryCard } from '../components/inventory/InventoryCard';
import { InventoryHistoryModal } from '../components/inventory/InventoryHistoryModal';
import { InventoryMovementModal } from '../components/inventory/InventoryMovementModal';
import { InventorySkeleton } from '../components/inventory/InventorySkeleton';
import { InventoryTable } from '../components/inventory/InventoryTable';
import { Card } from '../components/ui/Card';
import { getApiErrorMessage } from '../services/apiErrors';
import { getBusinesses, type Business } from '../services/business';
import type { IngredientCostImpact } from '../services/costing';
import { createIngredient, deleteIngredient, getInventory, getInventoryMovements, getInventorySummary, stockMovement, updateIngredient, type Ingredient, type IngredientPayload, type InventoryMovement, type InventorySummary } from '../services/inventory';

const emptyPayload: IngredientPayload = {
  negocio: 0,
  name: '',
  description: '',
  sku: '',
  category: 'otros',
  unit: 'kg',
  current_stock: '0.000',
  minimum_stock: '0.000',
  purchase_price: '0.00',
  supplier: '',
  barcode: '',
  active: true,
};

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
  const [costImpact, setCostImpact] = useState<IngredientCostImpact | null>(null);
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

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyPayload, negocio: businessId ?? 0 });
    setShowForm(true);
  };

  const openEdit = (ingredient: Ingredient) => {
    setEditing(ingredient);
    setForm({
      negocio: ingredient.negocio,
      name: ingredient.name,
      description: ingredient.description,
      sku: ingredient.sku,
      category: ingredient.category,
      unit: ingredient.unit,
      current_stock: ingredient.current_stock,
      minimum_stock: ingredient.minimum_stock,
      purchase_price: ingredient.purchase_price,
      supplier: ingredient.supplier,
      barcode: ingredient.barcode,
      active: ingredient.active,
    });
    setShowForm(true);
  };

  const saveIngredient = async () => {
    try {
      setSaving(true);
      const response = editing ? await updateIngredient(editing.id, form) : await createIngredient(form);
      if ('affected_products' in response) setCostImpact(response);
      setShowForm(false);
      await load(businessId ?? undefined);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'No pudimos guardar el insumo.'));
    } finally {
      setSaving(false);
    }
  };

  const runMovement = async (quantity: string, notes: string) => {
    if (!movementIngredient) return;
    try {
      setSaving(true);
      await stockMovement(movementIngredient.id, movementAction, quantity, notes);
      setMovementIngredient(null);
      await load(businessId ?? undefined);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'No pudimos registrar el movimiento.'));
    } finally {
      setSaving(false);
    }
  };

  const openHistory = async (ingredient: Ingredient) => {
    setHistoryIngredient(ingredient);
    setMovements(await getInventoryMovements(ingredient.id));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">Inventario</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900">Insumos</h1>
          <p className="mt-2 text-sm text-slate-500">Stock real de ingredientes, envases y materiales que usas para preparar productos.</p>
        </div>
        <button onClick={openCreate} className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white"><Plus size={17} />Nuevo insumo</button>
      </div>

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <div className="grid gap-4 sm:grid-cols-4">
        <InventoryCard title="Total insumos" value={String(summary?.total_ingredients ?? 0)} />
        <InventoryCard title="Valor inventario" value={formatCurrency(Number(summary?.inventory_value ?? 0))} />
        <InventoryCard title="Stock bajo" value={String(summary?.low_stock ?? 0)} />
        <InventoryCard title="Movimientos hoy" value={String(summary?.movements_today ?? 0)} />
      </div>

      <Card>
        <div className="grid gap-3 sm:grid-cols-3">
          {businesses.length > 1 ? (
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">Negocio</span>
              <select value={businessId ?? ''} onChange={(event) => void load(Number(event.target.value))} className="w-full rounded-2xl border px-4 py-3 text-sm">
                {businesses.map((business) => <option key={business.id} value={business.id}>{business.name}</option>)}
              </select>
            </label>
          ) : null}
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">Categoria de insumo</span>
            <select value={category} onChange={(event) => setCategory(event.target.value)} className="w-full rounded-2xl border px-4 py-3 text-sm">
              <option value="">Todas las categorias</option>
              <option value="lacteos">Lacteos</option>
              <option value="carnes">Carnes</option>
              <option value="verduras">Verduras</option>
              <option value="bebidas">Bebidas</option>
              <option value="harinas">Harinas</option>
              <option value="descartables">Descartables</option>
              <option value="otros">Otros</option>
            </select>
          </label>
          <label className="flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm">
            <span><span className="block font-medium text-slate-700">Solo stock bajo</span><span className="block text-xs text-slate-500">Muestra insumos en o debajo del minimo.</span></span>
            <input type="checkbox" checked={lowStock} onChange={(event) => setLowStock(event.target.checked)} />
          </label>
        </div>
      </Card>

      {loading ? <InventorySkeleton /> : <InventoryTable ingredients={ingredients} formatCurrency={formatCurrency} onEdit={openEdit} onDelete={async (item) => { await deleteIngredient(item.id); await load(businessId ?? undefined); }} onMovement={(item, action) => { setMovementIngredient(item); setMovementAction(action); }} onHistory={(item) => void openHistory(item)} />}

      {showForm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4">
          <div className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-xl font-semibold text-slate-900">{editing ? 'Editar insumo' : 'Nuevo insumo'}</h2>
            <p className="mt-2 text-sm text-slate-500">Carga datos como los usas en tu cocina: unidad de stock, cantidad disponible, minimo y costo de compra.</p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Nombre del insumo</span>
                <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Ej. Mozzarella" className="w-full rounded-2xl border px-4 py-3 text-sm" />
                <span className="mt-1 block text-xs text-slate-500">Debe coincidir con como lo reconoces al armar recetas.</span>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Codigo interno o SKU</span>
                <input value={form.sku} onChange={(event) => setForm({ ...form, sku: event.target.value })} placeholder="Ej. MOZ-001" className="w-full rounded-2xl border px-4 py-3 text-sm" />
                <span className="mt-1 block text-xs text-slate-500">Opcional. Util si manejas planillas o proveedores.</span>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Categoria</span>
                <select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} className="w-full rounded-2xl border px-4 py-3 text-sm">
                  <option value="lacteos">Lacteos</option><option value="carnes">Carnes</option><option value="verduras">Verduras</option><option value="bebidas">Bebidas</option><option value="harinas">Harinas</option><option value="descartables">Descartables</option><option value="otros">Otros</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Unidad en la que controlas stock</span>
                <select value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value as IngredientPayload['unit'] })} className="w-full rounded-2xl border px-4 py-3 text-sm">
                  <option value="kg">kg</option><option value="g">g</option><option value="l">l</option><option value="ml">ml</option><option value="unidad">unidad</option><option value="docena">docena</option><option value="caja">caja</option><option value="bolsa">bolsa</option><option value="pack">pack</option>
                </select>
                <span className="mt-1 block text-xs text-slate-500">Ejemplo: si compras mozzarella por kilo, usa kg. Las recetas pueden usar gramos.</span>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Stock actual</span>
                <input value={form.current_stock} onChange={(event) => setForm({ ...form, current_stock: event.target.value })} placeholder="Ej. 12.500" inputMode="decimal" className="w-full rounded-2xl border px-4 py-3 text-sm" />
                <span className="mt-1 block text-xs text-slate-500">Cantidad disponible en la unidad elegida. Ej: 12.5 kg.</span>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Stock minimo recomendado</span>
                <input value={form.minimum_stock} onChange={(event) => setForm({ ...form, minimum_stock: event.target.value })} placeholder="Ej. 5.000" inputMode="decimal" className="w-full rounded-2xl border px-4 py-3 text-sm" />
                <span className="mt-1 block text-xs text-slate-500">Pedilo marca stock bajo cuando llegas a este nivel.</span>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Costo de compra por unidad de stock</span>
                <input value={form.purchase_price} onChange={(event) => setForm({ ...form, purchase_price: event.target.value })} placeholder="Ej. 9200" inputMode="decimal" className="w-full rounded-2xl border px-4 py-3 text-sm" />
                <span className="mt-1 block text-xs text-slate-500">Si la unidad es kg, este es el costo por kg. Se usa para recetas, margen y rentabilidad.</span>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Proveedor habitual</span>
                <input value={form.supplier} onChange={(event) => setForm({ ...form, supplier: event.target.value })} placeholder="Ej. Lacteos Don Pepe" className="w-full rounded-2xl border px-4 py-3 text-sm" />
                <span className="mt-1 block text-xs text-slate-500">Opcional. Sirve para saber a quien reponerle.</span>
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button onClick={() => setShowForm(false)} className="rounded-2xl border px-4 py-2 text-sm">Cancelar</button>
              <button disabled={saving} onClick={() => void saveIngredient()} className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{saving ? 'Guardando...' : 'Guardar insumo'}</button>
            </div>
          </div>
        </div>
      ) : null}

      <InventoryMovementModal ingredient={movementIngredient} action={movementAction} saving={saving} onClose={() => setMovementIngredient(null)} onSubmit={(quantity, notes) => void runMovement(quantity, notes)} />
      <InventoryHistoryModal ingredient={historyIngredient} movements={movements} onClose={() => setHistoryIngredient(null)} />
      <IngredientCostImpactModal impact={costImpact} onClose={() => setCostImpact(null)} formatCurrency={formatCurrency} />
    </div>
  );
}
