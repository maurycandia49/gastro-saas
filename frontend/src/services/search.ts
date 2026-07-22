import api from './api';

export type SearchGroupKey = 'products' | 'categories' | 'orders' | 'customers' | 'promotions' | 'inventory' | 'costing';

export interface SearchResult {
  id: number | string;
  title: string;
  subtitle: string;
  url: string;
}

export type SearchResults = Record<SearchGroupKey, SearchResult[]>;

export async function globalSearch(businessId: number, query: string) {
  const response = await api.get<SearchResults>('/search/', { params: { business_id: businessId, q: query } });
  return response.data;
}
