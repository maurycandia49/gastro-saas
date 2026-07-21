import api from './api';

export interface RecipeItem {
  id: number;
  producto: number;
  ingredient: number;
  ingredient_name: string;
  ingredient_unit: string;
  quantity: string;
  unit: string;
  waste_percentage: string;
  notes: string;
  item_cost: string;
}

export interface RecipeResponse {
  items: RecipeItem[];
  recipe_cost: string;
  ingredients_count: number;
  missing_costs: string[];
  incomplete_recipe: boolean;
  available_units: number | null;
  limiting_ingredient: string | null;
  alerts: string[];
}

export interface RecipeItemPayload {
  ingredient: number;
  quantity: string;
  unit: string;
  waste_percentage: string;
  notes: string;
}

export async function getRecipe(productId: number) {
  const response = await api.get<RecipeResponse>(`/products/${productId}/recipe/`);
  return response.data;
}

export async function addRecipeItem(productId: number, payload: RecipeItemPayload) {
  const response = await api.post<RecipeResponse>(`/products/${productId}/recipe/`, payload);
  return response.data;
}

export async function replaceRecipe(productId: number, payload: RecipeItemPayload[]) {
  const response = await api.put<RecipeResponse>(`/products/${productId}/recipe/`, payload);
  return response.data;
}

export async function deleteRecipeItem(productId: number, itemId: number) {
  const response = await api.delete<RecipeResponse>(`/products/${productId}/recipe/${itemId}/`);
  return response.data;
}
