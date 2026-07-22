import api from './api';

export interface BusinessSettings {
  id: number;
  negocio: number;
  currency: string;
  timezone: string;
  orders_enabled: boolean;
  delivery_enabled: boolean;
  pickup_enabled: boolean;
  minimum_order: string;
  delivery_fee: string;
  free_delivery_from: string | null;
  estimated_delivery_minutes: number | null;
  estimated_pickup_minutes: number | null;
  whatsapp_number: string;
  whatsapp_message_template: string;
  require_customer_phone: boolean;
  require_delivery_address: boolean;
  show_out_of_stock_products: boolean;
  accept_orders_when_closed: boolean;
  automatic_order_acceptance: boolean;
  prevent_sales_without_stock: boolean;
  target_margin_percentage: string;
  low_margin_threshold: string;
  cost_increase_alert_percentage: string;
}

export interface BusinessSchedule {
  id?: number;
  weekday: number;
  is_closed: boolean;
  opening_time: string | null;
  closing_time: string | null;
}

export async function getBusinessSettings(businessId: number) {
  const response = await api.get<BusinessSettings>('/business-settings/', { params: { business_id: businessId } });
  return response.data;
}

export async function updateBusinessSettings(businessId: number, payload: Partial<BusinessSettings>) {
  const response = await api.patch<BusinessSettings>('/business-settings/', payload, { params: { business_id: businessId } });
  return response.data;
}

export async function getBusinessSchedules(businessId: number) {
  const response = await api.get<BusinessSchedule[]>('/business-schedules/', { params: { business_id: businessId } });
  return response.data;
}

export async function updateBusinessSchedules(businessId: number, payload: BusinessSchedule[]) {
  const response = await api.put<BusinessSchedule[]>('/business-schedules/', payload, { params: { business_id: businessId } });
  return response.data;
}
