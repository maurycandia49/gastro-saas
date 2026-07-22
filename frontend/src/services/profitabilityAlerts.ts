import api from './api';
import type { CostingAlert } from './costing';

export async function getProfitabilityAlerts(businessId: number) {
  const response = await api.get<CostingAlert[]>('/profitability-alerts/', { params: { business_id: businessId } });
  return response.data;
}

export async function updateProfitabilityAlert(alertId: number, payload: { read?: boolean; resolved?: boolean }) {
  const response = await api.patch<{ id: number; read: boolean; resolved: boolean; resolved_at: string | null }>(`/profitability-alerts/${alertId}/`, payload);
  return response.data;
}
