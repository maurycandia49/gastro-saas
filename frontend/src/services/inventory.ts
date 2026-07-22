import api from './api';
import type { IngredientCostImpact } from './costing';

export type IngredientUnit = 'kg' | 'g' | 'l' | 'ml' | 'unidad' | 'docena' | 'caja' | 'bolsa' | 'pack';
export type MovementType = 'purchase' | 'manual_adjustment' | 'recipe_consumption' | 'sale_consumption' | 'loss' | 'return';

export interface Ingredient {
  id: number;
  negocio: number;
  name: string;
  description: string;
  sku: string;
  category: string;
  unit: IngredientUnit;
  current_stock: string;
  minimum_stock: string;
  purchase_price: string;
  supplier: string;
  barcode: string;
  active: boolean;
  inventory_value: string;
  low_stock: boolean;
  created_at: string;
  updated_at: string;
}

export interface IngredientPayload {
  negocio: number;
  name: string;
  description: string;
  sku: string;
  category: string;
  unit: IngredientUnit;
  current_stock: string;
  minimum_stock: string;
  purchase_price: string;
  supplier: string;
  barcode: string;
  active: boolean;
}

export interface InventorySummary {
  total_ingredients: number;
  inventory_value: string;
  low_stock: number;
  movements_today: number;
}

export interface InventoryMovement {
  id: number;
  ingredient: number;
  movement_type: MovementType;
  quantity: string;
  previous_stock: string;
  new_stock: string;
  notes: string;
  pedido: number | null;
  producto: number | null;
  created_at: string;
  created_by_name: string;
}

export async function getInventory(params?: Record<string, string | number | boolean | undefined>) {
  const response = await api.get<Ingredient[]>('/inventory/', { params });
  return response.data;
}

export async function getInventorySummary(params?: Record<string, string | number | boolean | undefined>) {
  const response = await api.get<InventorySummary>('/inventory/summary/', { params });
  return response.data;
}

export async function createIngredient(payload: IngredientPayload) {
  const response = await api.post<Ingredient>('/inventory/', payload);
  return response.data;
}

export async function updateIngredient(id: number, payload: Partial<IngredientPayload>) {
  const response = await api.patch<Ingredient | (IngredientCostImpact & { ingredient: Ingredient; new_price: string; affected_products_count: number; alerts_created: number })>(`/inventory/${id}/`, payload);
  return response.data;
}

export async function deleteIngredient(id: number) {
  await api.delete(`/inventory/${id}/`);
}

export async function stockMovement(id: number, action: 'increase' | 'decrease' | 'adjust', quantity: string, notes: string) {
  const response = await api.post<InventoryMovement>(`/inventory/${id}/${action}/`, { quantity, notes });
  return response.data;
}

export async function getInventoryMovements(id: number) {
  const response = await api.get<InventoryMovement[]>(`/inventory/${id}/movements/`);
  return response.data;
}
