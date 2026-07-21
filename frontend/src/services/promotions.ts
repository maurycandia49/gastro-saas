import api from './api';

export type PromotionType = 'percentage' | 'fixed_price';

export interface Promotion {
  id: number;
  negocio: number;
  name: string;
  description: string;
  promotion_type: PromotionType;
  percentage_discount: string | null;
  fixed_price: string | null;
  producto: number | null;
  categoria: number | null;
  target_name: string;
  starts_at: string;
  ends_at: string;
  active: boolean;
  featured: boolean;
  created_at: string;
  updated_at: string;
}

export interface PromotionPayload {
  negocio: number;
  name: string;
  description: string;
  promotion_type: PromotionType;
  percentage_discount?: string | null;
  fixed_price?: string | null;
  producto?: number | null;
  categoria?: number | null;
  starts_at: string;
  ends_at: string;
  active: boolean;
  featured: boolean;
}

export async function getPromotions(filters?: { business_id?: number; active?: boolean; featured?: boolean; promotion_type?: PromotionType }) {
  const response = await api.get<Promotion[]>('/promotions/', { params: filters });
  return response.data;
}

export async function createPromotion(payload: PromotionPayload) {
  const response = await api.post<Promotion>('/promotions/', payload);
  return response.data;
}

export async function updatePromotion(id: number, payload: Partial<PromotionPayload>) {
  const response = await api.patch<Promotion>(`/promotions/${id}/`, payload);
  return response.data;
}

export async function deletePromotion(id: number) {
  await api.delete(`/promotions/${id}/`);
}
