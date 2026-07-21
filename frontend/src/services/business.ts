import api from './api';

export interface Business {
  id: number;
  name: string;
  description?: string;
  phone?: string;
  email?: string;
  address?: string;
  logo?: string | null;
  cover_image?: string | null;
  primary_color?: string;
  opening_hours?: string;
  instagram?: string;
  facebook?: string;
  active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CreateBusinessPayload {
  name: string;
  phone: string;
  email: string;
  address: string;
  logo?: string;
}

export interface UpdateBusinessPayload {
  name: string;
  description: string;
  phone: string;
  email: string;
  address: string;
  opening_hours: string;
  instagram: string;
  facebook: string;
  primary_color: string;
  logo?: File | null;
  cover_image?: File | null;
}

export async function getBusinesses() {
  const response = await api.get<Business[]>('/negocios/');
  return response.data;
}

export async function createBusiness(payload: CreateBusinessPayload) {
  const cleanPayload = Object.fromEntries(
    Object.entries(payload).filter(([_, value]) => value !== '' && value !== null && value !== undefined)
  );

  const response = await api.post<Business>('/negocios/', cleanPayload);

  return response.data;
}

export async function updateBusiness(id: number, payload: UpdateBusinessPayload) {
  const formData = new FormData();

  Object.entries(payload).forEach(([key, value]) => {
    if ((key === 'logo' || key === 'cover_image') && value instanceof File) {
      formData.append(key, value);
      return;
    }

    if (typeof value === 'string') {
      formData.append(key, value);
    }
  });

  const response = await api.patch<Business>(`/negocios/${id}/`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  return response.data;
}
