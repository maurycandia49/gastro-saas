import api from './api';

export interface CostBreakdownItem {
  ingredient_id: number;
  ingredient_name: string;
  recipe_quantity: string;
  recipe_unit: string;
  stock_unit: string;
  effective_quantity: string;
  waste_percentage: string;
  purchase_price: string;
  calculated_cost: string;
  percentage_of_total_cost: string | null;
}

export interface CostingAlert {
  id: number;
  type?: string;
  alert_type?: string;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  read: boolean;
  resolved?: boolean;
  product_name?: string;
}

export interface SuggestedPrice {
  current_price: string;
  recipe_cost: string;
  target_margin: string;
  suggested_price: string;
  price_difference: string;
  percentage_increase: string | null;
  projected_unit_profit: string;
}

export interface ProductCost {
  product_id: number;
  name: string;
  category: string;
  price: string;
  recipe_cost: string;
  sale_price: string;
  unit_profit: string;
  margin_percentage: string | null;
  markup_percentage: string | null;
  ingredients_count: number;
  missing_costs: string[];
  incomplete_recipe: boolean;
  cost_breakdown: CostBreakdownItem[];
  available_units: number | null;
  limiting_ingredient: string | null;
  alerts: string[];
  suggested_price: SuggestedPrice | null;
  active_alerts: CostingAlert[];
  snapshots?: Array<{
    id: number;
    recipe_cost: string;
    sale_price: string;
    unit_profit: string;
    margin_percentage: string | null;
    markup_percentage: string | null;
    trigger: string;
    calculated_at: string;
  }>;
}

export interface CostingSummary {
  products_count: number;
  products_with_complete_recipe: number;
  products_without_recipe: number;
  products_with_low_margin: number;
  products_with_negative_profit: number;
  average_margin: string | null;
  estimated_catalog_profit: string;
  estimated_catalog_profit_definition: string;
  most_profitable_product: { product_id: number; name: string; unit_profit: string; margin_percentage: string | null } | null;
  least_profitable_product: { product_id: number; name: string; unit_profit: string; margin_percentage: string | null } | null;
  active_alerts_count: number;
}

export interface IngredientCostImpact {
  ingredient: { id: number; name: string; unit: string };
  previous_price: string | null;
  current_price: string;
  variation_percentage: string | null;
  affected_products: Array<{
    product_id: number;
    name: string;
    previous_cost: string | null;
    current_cost: string;
    cost_change: string;
    cost_change_percentage: string | null;
    previous_margin: string | null;
    current_margin: string | null;
    margin_points_lost: string | null;
    suggested_price: SuggestedPrice | null;
  }>;
}

export async function getCostingProducts(businessId: number) {
  const response = await api.get<ProductCost[]>('/costing/products/', { params: { business_id: businessId } });
  return response.data;
}

export async function getCostingProduct(productId: number) {
  const response = await api.get<ProductCost>(`/costing/products/${productId}/`);
  return response.data;
}

export async function getCostingSummary(businessId: number) {
  const response = await api.get<CostingSummary>('/costing/summary/', { params: { business_id: businessId } });
  return response.data;
}

export async function recalculateProductCost(productId: number) {
  const response = await api.post<ProductCost & { snapshot_created: boolean }>(`/costing/products/${productId}/recalculate/`);
  return response.data;
}

export async function getSuggestedPrice(productId: number, targetMargin: number) {
  const response = await api.get<SuggestedPrice>(`/costing/products/${productId}/suggested-price/`, { params: { target_margin: targetMargin } });
  return response.data;
}

export async function applySuggestedPrice(productId: number, targetMargin: number) {
  const response = await api.post<{ product: ProductCost; suggestion: SuggestedPrice }>(`/costing/products/${productId}/apply-suggested-price/`, { target_margin: targetMargin });
  return response.data;
}

export async function getIngredientCostImpact(ingredientId: number) {
  const response = await api.get<IngredientCostImpact>(`/inventory/${ingredientId}/cost-impact/`);
  return response.data;
}
