import api from './api';

export interface Business {
  id: number;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  logo?: string;
  active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export async function getBusinesses() {
  const response = await api.get<Business[]>('/negocios/');
  return response.data;
}
