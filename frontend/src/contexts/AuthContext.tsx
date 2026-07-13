import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { logout as logoutService, register as registerService, type RegisterPayload } from '../services/auth';
import type { AuthContextType, User } from '../types';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem('pedilo_user');
    const storedAccess = localStorage.getItem('pedilo_access');
    const storedRefresh = localStorage.getItem('pedilo_refresh');

    if (storedUser && storedAccess && storedRefresh) {
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        localStorage.removeItem('pedilo_user');
      }
    }
    setLoading(false);
  }, []);

  const login = (tokens: { access: string; refresh: string }, userData: User) => {
    localStorage.setItem('pedilo_access', tokens.access);
    localStorage.setItem('pedilo_refresh', tokens.refresh);
    localStorage.setItem('pedilo_user', JSON.stringify(userData));
    setUser(userData);
  };

  const register = async (payload: RegisterPayload) => {
    return registerService(payload);
  };

  const logout = async () => {
    const refreshToken = localStorage.getItem('pedilo_refresh');
    try {
      if (refreshToken) {
        await logoutService(refreshToken);
      }
    } catch {
      // Ignore server errors and clear client state anyway.
    } finally {
      localStorage.removeItem('pedilo_access');
      localStorage.removeItem('pedilo_refresh');
      localStorage.removeItem('pedilo_user');
      setUser(null);
      window.location.assign('/login');
    }
  };

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      login,
      logout,
      register,
      loading,
    }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
