export interface User {
  id: number;
  username: string;
  email: string;
  first_name?: string;
  last_name?: string;
}

import type { RegisterPayload } from '../services/auth';

export interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (tokens: { access: string; refresh: string }, user: User) => void;
  logout: () => Promise<void>;
  register: (payload: RegisterPayload) => Promise<unknown>;
  loading: boolean;
}
