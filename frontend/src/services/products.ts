import api from './api';

export interface Product {
  id: number;
  negocio: number;
  categoria: number;
  name: string;
  description: string;
  price: string;
  cost_price: string;
  image: string | null;
  available: boolean;
  featured: boolean;
  order: number;
  created_at?: string;
  updated_at?: string;
}

export interface ProductPayload {
  negocio: number;
  categoria: number;
  name: string;
  description: string;
  price: string;
  cost_price?: string;
  image?: string;
  available: boolean;
  featured: boolean;
  order: number;
}

export type CreateProductPayload = ProductPayload;
export type UpdateProductPayload = Partial<ProductPayload>;

function cleanPayload<T extends object>(payload: T): Partial<T> {
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== '' && value !== undefined && value !== null)) as Partial<T>;
}

export async function getProducts() {
  const response = await api.get<Product[]>('/productos/');
  return response.data;
}

export async function createProduct(payload: CreateProductPayload) {
  const response = await api.post('/productos/', cleanPayload(payload));
  return response.data;
}

export async function updateProduct(id: number, payload: UpdateProductPayload) {
  const response = await api.patch(`/productos/${id}/`, cleanPayload(payload));
  return response.data;
}

export async function deleteProduct(id: number) {
  await api.delete(`/productos/${id}/`);
}
