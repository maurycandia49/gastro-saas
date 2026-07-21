import { useEffect, useState } from 'react';
import type { Ingredient } from '../../services/inventory';
import { addRecipeItem, deleteRecipeItem, getRecipe, type RecipeResponse } from '../../services/recipes';
import type { Product } from '../../services/products';
import { getApiErrorMessage } from '../../services/apiErrors';

export function RecipeModal({ product, ingredients, onClose }: { product: Product | null; ingredients: Ingredient[]; onClose: () => void }) {
  const [recipe, setRecipe] = useState<RecipeResponse | null>(null);
  const [ingredient, setIngredient] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('kg');
  const [waste, setWaste] = useState('0.00');
  const [error, setError] = useState('');
  if (!product) return null;

  useEffect(() => { void getRecipe(product.id).then(setRecipe).catch((err) => setError(getApiErrorMessage(err))); }, [product.id]);

  const add = async () => {
    try {
      const next = await addRecipeItem(product.id, { ingredient: Number(ingredient), quantity, unit, waste_percentage: waste, notes: '' });
      setRecipe(next); setQuantity(''); setWaste('0.00');
    } catch (err) { setError(getApiErrorMessage(err, 'No pudimos guardar la receta.')); }
  };

  const remove = async (itemId: number) => setRecipe(await deleteRecipeItem(product.id, itemId));
  const price = Number(product.price);
  const cost = Number(recipe?.recipe_cost ?? 0);
  const profit = price - cost;
  const margin = price > 0 ? (profit / price) * 100 : 0;

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"><div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6"><div className="flex justify-between"><div><h2 className="text-xl font-semibold">Receta</h2><p className="text-sm text-slate-500">{product.name}</p></div><button onClick={onClose}>Cerrar</button></div>{error ? <div className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}<div className="mt-5 grid gap-3 sm:grid-cols-4"><div className="rounded-2xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Costo</p><p className="font-semibold">${cost.toFixed(2)}</p></div><div className="rounded-2xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Ganancia</p><p className="font-semibold">${profit.toFixed(2)}</p></div><div className="rounded-2xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Margen</p><p className="font-semibold">{margin.toFixed(1)}%</p></div><div className="rounded-2xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Producibles</p><p className="font-semibold">{recipe?.available_units ?? '-'}</p></div></div><div className="mt-5 grid gap-3 sm:grid-cols-[1fr_110px_100px_100px_auto]"><select value={ingredient} onChange={(e) => { const ing = ingredients.find((i) => i.id === Number(e.target.value)); setIngredient(e.target.value); if (ing) setUnit(ing.unit); }} className="rounded-2xl border px-3 py-2"><option value="">Ingrediente</option>{ingredients.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</select><input value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="Cantidad" className="rounded-2xl border px-3 py-2" /><input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="Unidad" className="rounded-2xl border px-3 py-2" /><input value={waste} onChange={(e) => setWaste(e.target.value)} placeholder="Merma %" className="rounded-2xl border px-3 py-2" /><button onClick={() => void add()} className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Agregar</button></div><div className="mt-5 space-y-3">{recipe?.items.length === 0 ? <p className="text-sm text-slate-500">Este producto todavia no tiene receta.</p> : recipe?.items.map((item) => <div key={item.id} className="flex justify-between rounded-2xl bg-slate-50 p-3 text-sm"><span>{item.ingredient_name}: {item.quantity} {item.unit} · merma {item.waste_percentage}%</span><button onClick={() => void remove(item.id)} className="text-red-600">Eliminar</button></div>)}</div>{recipe?.limiting_ingredient ? <p className="mt-4 text-sm text-slate-500">Ingrediente limitante: {recipe.limiting_ingredient}</p> : null}</div></div>;
}
