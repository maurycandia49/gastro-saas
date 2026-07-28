import api from './api';

const activeGenerateRequests = new Map<number, Promise<Opportunity[]>>();

export interface Opportunity {
  id: number;
  opportunity_type: string;
  category: string;
  title: string;
  message: string;
  severity: 'info' | 'success' | 'warning' | 'critical';
  priority: number;
  score_impact: number;
  action_label: string;
  action_url: string;
  metadata: Record<string, unknown>;
  active: boolean;
  read: boolean;
  dismissed: boolean;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

export interface OpportunitySummary {
  active_count: number;
  critical_count: number;
  warning_count: number;
  success_count: number;
  unread_count: number;
  top_opportunities: Opportunity[];
  last_generated_at: string | null;
}

export interface BusinessHealth {
  score: number;
  label: string;
  breakdown: Record<string, number>;
  actions: Array<{ label: string; points: number; url: string }>;
  points_recoverable: number;
  generated_at: string;
}

export async function getOpportunities(businessId: number, params?: Record<string, string | boolean | undefined>) {
  const response = await api.get<Opportunity[]>('/opportunities/', { params: { business_id: businessId, ...params } });
  return response.data;
}

export async function generateOpportunities(businessId: number) {
  const existingRequest = activeGenerateRequests.get(businessId);
  if (existingRequest) return existingRequest;
  const request = api.post<Opportunity[]>('/opportunities/generate/', null, { params: { business_id: businessId } })
    .then((response) => response.data)
    .finally(() => activeGenerateRequests.delete(businessId));
  activeGenerateRequests.set(businessId, request);
  return request;
}

export async function updateOpportunity(id: number, payload: { read?: boolean; dismissed?: boolean }) {
  const response = await api.patch<Opportunity>(`/opportunities/${id}/`, payload);
  return response.data;
}

export async function getOpportunitiesSummary(businessId: number) {
  const response = await api.get<OpportunitySummary>('/opportunities/summary/', { params: { business_id: businessId } });
  return response.data;
}

export async function getBusinessHealth(businessId: number) {
  const response = await api.get<BusinessHealth>('/business-health/', { params: { business_id: businessId } });
  return response.data;
}
