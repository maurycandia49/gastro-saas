import type { Ingredient } from '../../services/inventory';

interface Props {
  value: number | null;
  ingredients: Ingredient[];
  onChange: (ingredientId: number | null) => void;
}

export function IngredientMatcher({ value, ingredients, onChange }: Props) {
  return (
    <select value={value ?? ''} onChange={(event) => onChange(event.target.value ? Number(event.target.value) : null)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">
      <option value="">Seleccionar insumo</option>
      {ingredients.map((ingredient) => <option key={ingredient.id} value={ingredient.id}>{ingredient.name}</option>)}
    </select>
  );
}
