import api from './api';
import type { User } from '../types';

export interface LoginPayload {
  username: string;
  password: string;
}

export interface RegisterPayload {
  username: string;
  email: string;
  password: string;
  first_name?: string;
  last_name?: string;
}

export interface AuthTokens {
  access: string;
  refresh: string;
}

export interface LoginResponse {
  access: string;
  refresh: string;
}

export function getAuthErrorMessage(error: unknown): string {
  if (typeof error === 'string') {
    return error;
  }

  if (error && typeof error === 'object' && 'response' in error) {
    const response = error as { response?: { data?: { detail?: string; [key: string]: unknown } } };
    const detail = response.response?.data?.detail;
    if (typeof detail === 'string') {
      return detail;
    }
  }

  return 'No se pudo completar la solicitud. Intentá nuevamente.';
}

export async function login(payload: LoginPayload): Promise<{ tokens: AuthTokens; user: User }> {
  const response = await api.post<LoginResponse>('/auth/login/', payload);

  const username = payload.username.trim();
  const user: User = {
    id: 0,
    username,
    email: `${username}@pedilo.local`,
  };

  return {
    tokens: {
      access: response.data.access,
      refresh: response.data.refresh,
    },
    user,
  };
}

export async function register(payload: RegisterPayload) {
  return api.post('/auth/register/', payload);
}

export async function logout(refreshToken: string) {
  return api.post('/auth/logout/', { refresh: refreshToken });
}
