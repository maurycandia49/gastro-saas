import api from './api';
import type { OrderStatus } from './orders';

export interface MetricOrder {
  id: number;
  customer_name: string;
  total: string;
  status: OrderStatus;
  created_at: string;
}

export interface TopProduct {
  product_id: number;
  name: string;
  quantity: number;
  revenue: string;
}

export interface MetricsSummary {
  sales_total: string;
  orders_count: number;
  average_ticket: string;
  items_sold: number;
  top_product: TopProduct | null;
  previous_period: {
    sales_total: string;
    orders_count: number;
  };
  sales_change_percentage: string | null;
  orders_by_status: Record<OrderStatus, number>;
  last_orders: MetricOrder[];
}

export interface HourlySale {
  hour: number;
  sales_total: string;
  orders_count: number;
}

export async function getMetricsSummary(businessId: number, period = 'today') {
  const response = await api.get<MetricsSummary>('/metrics/summary/', {
    params: { business_id: businessId, period },
  });
  return response.data;
}

export async function getHourlySales(businessId: number, date: string) {
  const response = await api.get<HourlySale[]>('/metrics/hourly-sales/', {
    params: { business_id: businessId, date },
  });
  return response.data;
}
