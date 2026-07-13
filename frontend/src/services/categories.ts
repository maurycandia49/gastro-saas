import api from './api';

export interface Category {
  id: number;
  negocio: number;
  name: string;
  description?: string;
  order?: number;
  active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export async function getCategories() {
  const response = await api.get<Category[]>('/categorias/');
  return response.data;
}
