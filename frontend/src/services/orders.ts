import api from './api';

export type OrderStatus = 'pendiente' | 'aceptado' | 'preparando' | 'listo' | 'entregado' | 'cancelado';

export interface OrderItem {
  id: number;
  product_id: number;
  product_name: string;
  unit_price: string;
  quantity: number;
  subtotal: string;
}

export interface Order {
  id: number;
  negocio: number;
  negocio_name: string;
  customer_name: string;
  customer_phone: string;
  delivery_address: string;
  notes: string;
  status: OrderStatus;
  total: string;
  items_count: number;
  created_at: string;
  updated_at: string;
  items: OrderItem[];
}

export interface PublicOrderPayload {
  business_id: number;
  customer_name: string;
  customer_phone: string;
  delivery_address: string;
  notes: string;
  items: Array<{
    product_id: number;
    quantity: number;
  }>;
}

export async function createPublicOrder(payload: PublicOrderPayload) {
  const response = await api.post<Order>('/public/orders/', payload);
  return response.data;
}

export async function getOrders(filters?: { status?: string; negocio?: number; fecha?: string }) {
  const response = await api.get<Order[]>('/orders/', { params: filters });
  return response.data;
}

export async function updateOrderStatus(orderId: number, status: OrderStatus) {
  const response = await api.patch<Order>(`/orders/${orderId}/`, { status });
  return response.data;
}
