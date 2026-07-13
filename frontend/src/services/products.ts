import api from './api';

export interface Product {
  id: number;
  negocio: number;
  categoria: number;
  name: string;
  description?: string;
  price?: string;
  image?: string;
  available?: boolean;
  featured?: boolean;
  order?: number;
  created_at?: string;
  updated_at?: string;
}

export async function getProducts() {
  const response = await api.get<Product[]>('/productos/');
  return response.data;
}
