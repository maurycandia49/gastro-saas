import api from './api';

export interface PublicMenuProduct {
  id: number;
  categoria: number;
  name: string;
  description: string;
  price: string;
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
  categorias: PublicMenuCategory[];
}

export async function getPublicMenu(businessId: string) {
  const response = await api.get<PublicMenu>(`/public/menu/${businessId}/`);
  return response.data;
}
