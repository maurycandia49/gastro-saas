import api from './api';

export interface Supplier {
  id: number;
  negocio: number;
  name: string;
  tax_id: string;
  contact_name: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export type SupplierPayload = Omit<Supplier, 'id' | 'created_at' | 'updated_at'>;

export async function getSuppliers(params?: Record<string, string | number | boolean | undefined>) {
  const response = await api.get<Supplier[]>('/suppliers/', { params });
  return response.data;
}

export async function createSupplier(payload: SupplierPayload) {
  const response = await api.post<Supplier>('/suppliers/', payload);
  return response.data;
}

export async function updateSupplier(id: number, payload: Partial<SupplierPayload>) {
  const response = await api.patch<Supplier>(`/suppliers/${id}/`, payload);
  return response.data;
}

export async function deleteSupplier(id: number) {
  const response = await api.delete<Supplier | void>(`/suppliers/${id}/`);
  return response.data;
}
