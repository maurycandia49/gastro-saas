import api from './api';
import type { OrderStatus } from './orders';

export interface CustomerSummary {
  phone: string;
  name: string;
  orders_count: number;
  total_spent: string;
  average_ticket: string;
  first_order_at: string;
  last_order_at: string;
  last_delivery_address: string;
  is_recurring: boolean;
  is_vip: boolean;
}

export interface CustomerOrder {
  id: number;
  customer_name: string;
  total: string;
  status: OrderStatus;
  created_at: string;
  delivery_address: string;
  items_count: number;
}

export interface FavoriteProduct {
  product_name: string;
  quantity: number;
  total_spent: string;
}

export interface CustomerDetail extends CustomerSummary {
  frequency_days: number | null;
  orders: CustomerOrder[];
  favorite_products: FavoriteProduct[];
  addresses: string[];
}

export async function getCustomers(businessId: number) {
  const response = await api.get<CustomerSummary[]>('/customers/', { params: { business_id: businessId } });
  return response.data;
}

export async function getCustomerDetail(businessId: number, phone: string) {
  const response = await api.get<CustomerDetail>(`/customers/${phone}/`, { params: { business_id: businessId } });
  return response.data;
}
