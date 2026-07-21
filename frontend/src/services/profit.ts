import api from './api';

export interface ProfitableProduct {
  product_id: number;
  name: string;
  sales: string;
  costs: string;
  profit: string;
  margin: string | null;
}

export interface ProfitMetrics {
  sales: string;
  costs: string;
  gross_profit: string;
  profit_margin: string | null;
  average_margin: string | null;
  top_profitable_product: ProfitableProduct | null;
  least_profitable_product: ProfitableProduct | null;
}

export async function getProfitMetrics(businessId: number, period = 'today') {
  const response = await api.get<ProfitMetrics>('/metrics/profit/', {
    params: { business_id: businessId, period },
  });
  return response.data;
}
