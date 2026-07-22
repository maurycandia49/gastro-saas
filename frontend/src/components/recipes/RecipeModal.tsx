import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Pencil, Trash2, X } from 'lucide-react';
import type { Ingredient } from '../../services/inventory';
import { addRecipeItem, deleteRecipeItem, getRecipe, replaceRecipe, type RecipeItem, type RecipeItemPayload, type RecipeResponse } from '../../services/recipes';
import type { Product } from '../../services/products';
import { getApiErrorMessage } from '../../services/apiErrors';

const unitOptions = ['kg', 'g', 'l', 'ml', 'unidad', 'docena', 'caja', 'bolsa', 'pack'];

function formatCurrency(value: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);
}

function formatQuantity(value: number) {
  return new Intl.NumberFormat('es-AR', { maximumFractionDigits: 3 }).format(value);
}

function compatibleUnits(stockUnit?: string) {
  if (stockUnit === 'kg' || stockUnit === 'g') return ['kg', 'g'];
  if (stockUnit === 'l' || stockUnit === 'ml') return ['l', 'ml'];
  return stockUnit ? [stockUnit] : unitOptions;
}

function convertQuantity(quantity: number, fromUnit: string, toUnit: string) {
  if (!quantity || quantity <= 0) return null;
  if (fromUnit === toUnit) return quantity;
  if (fromUnit === 'g' && toUnit === 'kg') return quantity / 1000;
  if (fromUnit === 'kg' && toUnit === 'g') return quantity * 1000;
  if (fromUnit === 'ml' && toUnit === 'l') return quantity / 1000;
  if (fromUnit === 'l' && toUnit === 'ml') return quantity * 1000;
  return null;
}

function friendlyError(error: unknown, fallback: string) {
  const raw = getApiErrorMessage(error, fallback);
  return raw
    .replace('Ensure this value is greater than 0.', 'La cantidad debe ser mayor que cero.')
    .replace('Invalid unit conversion.', 'No se puede convertir esa unidad. Elegi una unidad compatible con la del inventario.')
    .replace('This field may not be null.', 'Este campo es obligatorio.')
    .replace('This field may not be blank.', 'Este campo es obligatorio.');
}

function payloadFromItem(item: RecipeItem): RecipeItemPayload {
  return {
    ingredient: item.ingredient,
    quantity: item.quantity,
    unit: item.unit,
    waste_percentage: item.waste_percentage,
    notes: item.notes ?? '',
  };
}

export function RecipeModal({ product, ingredients, onClose }: { product: Product | null; ingredients: Ingredient[]; onClose: () => void }) {
  const [recipe, setRecipe] = useState<RecipeResponse | null>(null);
  const [ingredient, setIngredient] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('kg');
  const [waste, setWaste] = useState('0');
  const [notes, setNotes] = useState('');
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [toast, setToast] = useState('');

  const selectedIngredient = useMemo(
    () => ingredients.find((item) => item.id === Number(ingredient)) ?? null,
    [ingredient, ingredients],
  );

  const allowedUnits = useMemo(() => compatibleUnits(selectedIngredient?.unit), [selectedIngredient?.unit]);

  const liveConversion = useMemo(() => {
    if (!selectedIngredient || !quantity) return null;
    const parsedQuantity = Number(quantity);
    const parsedWaste = Number(waste || 0);
    const converted = convertQuantity(parsedQuantity, unit, selectedIngredient.unit);
    if (converted === null) return { incompatible: true };
    const withWaste = converted * (1 + Math.max(parsedWaste, 0) / 100);
    return { converted, withWaste, stockUnit: selectedIngredient.unit, incompatible: false };
  }, [quantity, selectedIngredient, unit, waste]);

  useEffect(() => {
    let active = true;

    setRecipe(null);
    setIngredient('');
    setQuantity('');
    setUnit('kg');
    setWaste('0');
    setNotes('');
    setEditingItemId(null);
    setError('');
    setFieldError('');
    setToast('');

    if (!product) {
      setLoading(false);
      return () => {
        active = false;
      };
    }

    setLoading(true);
    void getRecipe(product.id)
      .then((response) => {
        if (active) setRecipe(response);
      })
      .catch((err) => {
        if (active) setError(friendlyError(err, 'No pudimos cargar la receta.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [product]);

  useEffect(() => {
    if (!toast) return undefined;
    const timeout = window.setTimeout(() => setToast(''), 2400);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  if (!product) return null;

  const price = Number(product.price);
  const cost = recipe?.incomplete_recipe ? null : Number(recipe?.recipe_cost ?? 0);
  const profit = cost === null ? null : price - cost;
  const margin = profit !== null && price > 0 ? (profit / price) * 100 : null;
  const hasIngredients = ingredients.length > 0;
  const isEditing = editingItemId !== null;

  const resetForm = () => {
    setIngredient('');
    setQuantity('');
    setUnit('kg');
    setWaste('0');
    setNotes('');
    setEditingItemId(null);
    setFieldError('');
  };

  const validateForm = () => {
    if (!ingredient) return 'Selecciona un ingrediente.';
    if (!quantity || Number(quantity) <= 0) return 'La cantidad debe ser mayor que cero.';
    if (Number(waste || 0) < 0 || Number(waste || 0) > 100) return 'La merma debe estar entre 0 y 100%.';
    if (liveConversion?.incompatible) return `No se puede convertir ${unit} a ${selectedIngredient?.unit}. Elegi una unidad compatible con la del inventario.`;
    return '';
  };

  const save = async () => {
    const validation = validateForm();
    if (validation) {
      setFieldError(validation);
      return;
    }

    try {
      setSaving(true);
      setError('');
      setFieldError('');
      const payload: RecipeItemPayload = { ingredient: Number(ingredient), quantity, unit, waste_percentage: waste || '0', notes };
      const next = isEditing && recipe
        ? await replaceRecipe(product.id, recipe.items.map((item) => item.id === editingItemId ? payload : payloadFromItem(item)))
        : await addRecipeItem(product.id, payload);
      setRecipe(next);
      resetForm();
      setToast(isEditing ? 'Ingrediente actualizado.' : 'Ingrediente agregado a la receta.');
    } catch (err) {
      setError(friendlyError(err, 'No pudimos guardar la receta.'));
    } finally {
      setSaving(false);
    }
  };

  const edit = (item: RecipeItem) => {
    setEditingItemId(item.id);
    setIngredient(String(item.ingredient));
    setQuantity(item.quantity);
    setUnit(item.unit);
    setWaste(item.waste_percentage);
    setNotes(item.notes ?? '');
    setFieldError('');
  };

  const remove = async (item: RecipeItem) => {
    if (!window.confirm(`¿Quitar ${item.ingredient_name} de la receta de ${product.name}?`)) return;
    try {
      setDeletingId(item.id);
      setError('');
      const next = await deleteRecipeItem(product.id, item.id);
      setRecipe(next);
      if (editingItemId === item.id) resetForm();
      setToast('Ingrediente eliminado.');
    } catch (err) {
      setError(friendlyError(err, 'No pudimos eliminar el ingrediente.'));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-slate-950/50 p-0 backdrop-blur-sm sm:items-center sm:justify-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="recipe-modal-title">
      <div className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-500">Editor de receta</p>
            <h2 id="recipe-modal-title" className="mt-1 text-2xl font-semibold text-slate-900">Receta de {product.name}</h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              Indica que insumos y cantidades necesitas para preparar una unidad de este producto. Pedilo usara esta receta para calcular costos y descontar stock automaticamente.
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100" aria-label="Cerrar editor de receta">
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-5 sm:px-6">
          {toast ? <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{toast}</div> : null}
          {error ? <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

          <div className="grid gap-5 lg:grid-cols-[1fr_0.85fr]">
            <section className="space-y-5">
              <div className="rounded-3xl border border-slate-200 p-4 sm:p-5">
                <h3 className="font-semibold text-slate-900">{isEditing ? 'Editar ingrediente' : 'Agregar ingrediente'}</h3>
                {!hasIngredients ? (
                  <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
                    <p className="font-medium text-slate-900">Todavia no tenes insumos cargados.</p>
                    <p className="mt-1 text-sm text-slate-500">Primero carga tus insumos en Inventario para poder usarlos en recetas.</p>
                    <Link to="/inventario" onClick={onClose} className="mt-3 inline-flex rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Ir a Inventario</Link>
                  </div>
                ) : (
                  <div className="mt-4 grid gap-4">
                    <label className="block" htmlFor="recipe-ingredient">
                      <span className="text-sm font-medium text-slate-700">Ingrediente</span>
                      <select id="recipe-ingredient" value={ingredient} onChange={(event) => { const ing = ingredients.find((item) => item.id === Number(event.target.value)); setIngredient(event.target.value); if (ing) setUnit(compatibleUnits(ing.unit)[0]); }} className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400">
                        <option value="">Selecciona un ingrediente</option>
                        {ingredients.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                      </select>
                      <span className="mt-1 block text-xs text-slate-500">Selecciona un insumo previamente cargado en Inventario.</span>
                    </label>

                    {selectedIngredient ? (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="font-semibold text-slate-900">{selectedIngredient.name}</p>
                            <p className="mt-1 text-sm text-slate-500">Unidad de inventario: {selectedIngredient.unit}</p>
                            {selectedIngredient.supplier ? <p className="text-sm text-slate-500">Proveedor: {selectedIngredient.supplier}</p> : null}
                          </div>
                          <span className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${selectedIngredient.low_stock ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                            {selectedIngredient.low_stock ? 'Stock bajo' : 'Stock suficiente'}
                          </span>
                        </div>
                        <div className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-3">
                          <p>Disponible: <span className="font-semibold text-slate-900">{formatQuantity(Number(selectedIngredient.current_stock))} {selectedIngredient.unit}</span></p>
                          <p>Minimo: <span className="font-semibold text-slate-900">{formatQuantity(Number(selectedIngredient.minimum_stock))} {selectedIngredient.unit}</span></p>
                          <p>Costo: <span className="font-semibold text-slate-900">{formatCurrency(Number(selectedIngredient.purchase_price))} por {selectedIngredient.unit}</span></p>
                        </div>
                      </div>
                    ) : null}

                    <div className="grid gap-4 sm:grid-cols-[1fr_150px_150px]">
                      <label className="block" htmlFor="recipe-quantity">
                        <span className="text-sm font-medium text-slate-700">Cantidad utilizada por unidad vendida</span>
                        <input id="recipe-quantity" value={quantity} onChange={(event) => setQuantity(event.target.value)} placeholder="Ej. 180" inputMode="decimal" className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400" />
                        <span className="mt-1 block text-xs text-slate-500">Indica cuanto de este ingrediente usa una unidad del producto.</span>
                      </label>
                      <label className="block" htmlFor="recipe-unit">
                        <span className="text-sm font-medium text-slate-700">Unidad</span>
                        <select id="recipe-unit" value={unit} onChange={(event) => setUnit(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400">
                          {allowedUnits.map((option) => <option key={option} value={option}>{option}</option>)}
                        </select>
                        <span className="mt-1 block text-xs text-slate-500">Elegi una unidad compatible con inventario.</span>
                      </label>
                      <label className="block" htmlFor="recipe-waste">
                        <span className="text-sm font-medium text-slate-700">Merma estimada</span>
                        <div className="mt-2 flex rounded-2xl border border-slate-200 focus-within:border-slate-400">
                          <input id="recipe-waste" value={waste} onChange={(event) => setWaste(event.target.value)} placeholder="Ej. 5" inputMode="decimal" className="w-full rounded-l-2xl px-4 py-3 text-sm outline-none" />
                          <span className="border-l border-slate-200 px-3 py-3 text-sm text-slate-500">%</span>
                        </div>
                        <span className="mt-1 block text-xs text-slate-500">Desperdicio habitual durante la preparacion. Opcional.</span>
                      </label>
                    </div>

                    <p className="rounded-2xl bg-blue-50 px-4 py-3 text-sm text-blue-800">
                      Ejemplo: si usas 180 g de mozzarella y calculas 5% de merma, Pedilo considerara un consumo real de 189 g.
                    </p>

                    {liveConversion ? (
                      <div className={`rounded-2xl px-4 py-3 text-sm ${liveConversion.incompatible ? 'bg-red-50 text-red-700' : 'bg-slate-50 text-slate-700'}`}>
                        {liveConversion.incompatible ? (
                          <>No se puede convertir {unit} a {selectedIngredient?.unit}. Elegi una unidad compatible con la del inventario.</>
                        ) : liveConversion.converted !== undefined && liveConversion.withWaste !== undefined ? (
                          <>
                            <p>Cantidad ingresada: <span className="font-semibold">{quantity} {unit}</span></p>
                            <p>Equivale a: <span className="font-semibold">{formatQuantity(liveConversion.converted)} {liveConversion.stockUnit}</span> de inventario</p>
                            <p>Consumo con merma: <span className="font-semibold">{formatQuantity(liveConversion.withWaste)} {liveConversion.stockUnit}</span></p>
                          </>
                        ) : null}
                      </div>
                    ) : null}

                    <label className="block" htmlFor="recipe-notes">
                      <span className="text-sm font-medium text-slate-700">Notas internas</span>
                      <input id="recipe-notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Ej. Sin desperdicio, peso escurrido o aclaracion interna." className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400" />
                    </label>

                    {fieldError ? <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{fieldError}</p> : null}

                    <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                      {isEditing ? <button type="button" onClick={resetForm} disabled={saving} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 disabled:opacity-60">Cancelar edicion</button> : null}
                      <button type="button" onClick={() => void save()} disabled={saving || !hasIngredients} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60">
                        {saving ? <Loader2 className="animate-spin" size={17} /> : null}
                        {saving ? 'Guardando ingrediente...' : isEditing ? 'Guardar cambios' : 'Agregar ingrediente'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-3xl border border-slate-200 p-4 sm:p-5">
                <h3 className="font-semibold text-slate-900">Ingredientes de la receta</h3>
                {loading ? (
                  <div className="mt-4 flex items-center gap-2 text-sm text-slate-500"><Loader2 className="animate-spin" size={16} /> Cargando receta...</div>
                ) : recipe?.items.length === 0 ? (
                  <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5">
                    <p className="font-semibold text-slate-900">Este producto todavia no tiene receta.</p>
                    <p className="mt-1 text-sm text-slate-500">Agrega los insumos que utilizas para preparar una unidad.</p>
                    <div className="mt-4 rounded-2xl bg-white p-4 text-sm text-slate-600">
                      <p className="font-medium text-slate-900">Ejemplo Pizza Muzzarella:</p>
                      <ul className="mt-2 list-disc space-y-1 pl-5">
                        <li>250 g de masa</li>
                        <li>180 g de mozzarella</li>
                        <li>90 ml de salsa</li>
                      </ul>
                    </div>
                    <button type="button" onClick={() => document.getElementById('recipe-ingredient')?.focus()} className="mt-4 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
                      Agregar primer ingrediente
                    </button>
                  </div>
                ) : (
                  <div className="mt-4 space-y-3">
                    {recipe?.items.map((item) => {
                      const effective = convertQuantity(Number(item.quantity) * (1 + Number(item.waste_percentage) / 100), item.unit, item.ingredient_unit);
                      const cost = Number(item.item_cost);
                      const total = Number(recipe.recipe_cost);
                      const percentage = total > 0 ? (cost / total) * 100 : null;
                      return (
                        <div key={item.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <p className="font-semibold text-slate-900">{item.ingredient_name}</p>
                              <p className="mt-1 text-sm text-slate-600">{item.quantity} {item.unit} + {Number(item.waste_percentage).toFixed(1)}% de merma</p>
                              <p className="mt-1 text-sm text-slate-500">Consumo efectivo: {effective === null ? 'No convertible' : `${formatQuantity(effective)} ${item.ingredient_unit}`}</p>
                              <p className="text-sm text-slate-500">Costo aportado: {Number(item.item_cost) > 0 ? formatCurrency(cost) : 'Falta cargar costo'}</p>
                              <p className="text-sm text-slate-500">Representa: {percentage === null ? '—' : `${percentage.toFixed(1)}%`} del costo total</p>
                              {item.notes ? <p className="mt-1 text-xs text-slate-400">Nota: {item.notes}</p> : null}
                            </div>
                            <div className="flex gap-2">
                              <button type="button" onClick={() => edit(item)} disabled={saving || deletingId !== null} className="rounded-xl border border-slate-200 p-2 text-slate-600 transition hover:bg-white disabled:opacity-60" aria-label={`Editar ${item.ingredient_name}`}>
                                <Pencil size={16} />
                              </button>
                              <button type="button" onClick={() => void remove(item)} disabled={saving || deletingId === item.id} className="rounded-xl border border-red-200 p-2 text-red-600 transition hover:bg-red-50 disabled:opacity-60" aria-label={`Eliminar ${item.ingredient_name}`}>
                                {deletingId === item.id ? <Loader2 className="animate-spin" size={16} /> : <Trash2 size={16} />}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>

            <aside className="space-y-4">
              <div className="rounded-3xl border border-slate-200 p-4 sm:p-5">
                <h3 className="font-semibold text-slate-900">Resumen de receta</h3>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                  <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Ingredientes</p><p className="mt-1 text-lg font-semibold text-slate-900">{recipe?.ingredients_count ?? 0}</p></div>
                  <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Costo estimado</p><p className="mt-1 text-lg font-semibold text-slate-900">{cost === null ? 'Incompleto' : formatCurrency(cost)}</p></div>
                  <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Precio de venta</p><p className="mt-1 text-lg font-semibold text-slate-900">{price > 0 ? formatCurrency(price) : 'Falta precio'}</p></div>
                  <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Ganancia estimada</p><p className="mt-1 text-lg font-semibold text-slate-900">{profit === null ? 'Incompleta' : formatCurrency(profit)}</p></div>
                  <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Margen estimado</p><p className="mt-1 text-lg font-semibold text-slate-900">{margin === null ? '—' : `${margin.toFixed(1)}%`}</p></div>
                  <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Unidades producibles</p><p className="mt-1 text-lg font-semibold text-slate-900">{recipe?.available_units ?? 'Sin receta'}</p></div>
                </div>
                <div className="mt-4 space-y-2 text-sm text-slate-600">
                  {recipe?.limiting_ingredient ? <p>Ingrediente limitante: <span className="font-semibold text-slate-900">{recipe.limiting_ingredient}</span></p> : null}
                  {recipe?.missing_costs.map((name) => <p key={name} className="text-amber-700">Falta cargar el costo de {name}.</p>)}
                  {recipe?.alerts.map((alert) => <p key={alert} className="text-amber-700">{alert}.</p>)}
                  {price <= 0 ? <p className="text-amber-700">Este producto todavia no tiene precio de venta.</p> : null}
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}
