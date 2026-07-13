import { createContext, useContext, useEffect, useMemo, useState } from 'react';
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
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  const login = (tokens: { access: string; refresh: string }, userData: User) => {
    localStorage.setItem('pedilo_access', tokens.access);
    localStorage.setItem('pedilo_refresh', tokens.refresh);
    localStorage.setItem('pedilo_user', JSON.stringify(userData));
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('pedilo_access');
    localStorage.removeItem('pedilo_refresh');
    localStorage.removeItem('pedilo_user');
    setUser(null);
  };

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      login,
      logout,
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
