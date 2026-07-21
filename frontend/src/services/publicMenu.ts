import api from './api';

export interface PublicMenuProduct {
  id: number;
  categoria: number;
  name: string;
  description: string;
  price: string;
  original_price: string;
  final_price: string;
  has_promotion: boolean;
  promotion_name: string;
  promotion_featured: boolean;
  discount_percentage: string | null;
  out_of_operational_stock: boolean;
  image: string | null;
  available: boolean;
  order: number;
}

export interface PublicMenuCategory {
  id: number;
  name: string;
  description: string;
  order: number;
  productos: PublicMenuProduct[];
}

export interface PublicMenu {
  id: number;
  name: string;
  description: string;
  phone: string;
  email: string;
  address: string;
  logo: string | null;
  cover_image: string | null;
  primary_color: string;
  opening_hours: string;
  instagram: string;
  facebook: string;
  is_open: boolean;
  accepts_orders: boolean;
  opening_status_message: string;
  delivery_enabled: boolean;
  pickup_enabled: boolean;
  minimum_order: string;
  delivery_fee: string;
  free_delivery_from: string | null;
  estimated_delivery_minutes: number | null;
  estimated_pickup_minutes: number | null;
  require_customer_phone: boolean;
  require_delivery_address: boolean;
  categorias: PublicMenuCategory[];
}

export async function getPublicMenu(businessId: string) {
  const response = await api.get<PublicMenu>(`/public/menu/${businessId}/`);
  return response.data;
}
