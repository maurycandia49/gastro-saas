import api from './api';

export interface Category {
  id: number;
  negocio: number;
  name: string;
  description: string;
  order: number;
  active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CategoryPayload {
  negocio: number;
  name: string;
  description: string;
  order: number;
  active: boolean;
}

export type CreateCategoryPayload = CategoryPayload;
export type UpdateCategoryPayload = Partial<CategoryPayload>;

export async function getCategories() {
  const response = await api.get<Category[]>('/categorias/');
  return response.data;
}

export async function createCategory(payload: CreateCategoryPayload) {
  const response = await api.post<Category>('/categorias/', payload);
  return response.data;
}

export async function updateCategory(id: number, payload: UpdateCategoryPayload) {
  const response = await api.patch<Category>(`/categorias/${id}/`, payload);
  return response.data;
}

export async function deleteCategory(id: number) {
  await api.delete(`/categorias/${id}/`);
}
