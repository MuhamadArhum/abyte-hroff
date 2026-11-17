import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import api from '../lib/api';

export type UserRole = 'ADMIN' | 'MANAGER' | 'HR' | 'VIEWER' | 'OTHER';
export type User = {
  id: number;
  username: string;
  role: UserRole;
  fullName?: string;
  mustChangePassword?: boolean;
};

type AuthCtx = {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  hasRole: (...roles: UserRole[]) => boolean;
  canWrite: boolean;
  isAdmin: boolean;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const r = await api.get('/auth/me');
    setUser(r.data.user);
  }, []);

  useEffect(() => {
    let active = true;
    api.get('/auth/me')
      .then((r) => { if (active) setUser(r.data.user); })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false); });
    const onExpired = () => { if (active) setUser(null); };
    const onPasswordRequired = () => { if (active) setUser((u) => (u ? { ...u, mustChangePassword: true } : u)); };
    window.addEventListener('ems:session-expired', onExpired);
    window.addEventListener('ems:password-change-required', onPasswordRequired);
    return () => {
      active = false;
      window.removeEventListener('ems:session-expired', onExpired);
      window.removeEventListener('ems:password-change-required', onPasswordRequired);
    };
  }, []);

  const login = async (username: string, password: string) => {
    const r = await api.post('/auth/login', { username, password });
    const next: User = r.data.user;
    setUser(next);
    return next;
  };

  const logout = async () => {
    await api.post('/auth/logout').catch(() => {});
    setUser(null);
    window.location.assign('/login');
  };

  const hasRole = (...roles: UserRole[]) => !!user && roles.includes(user.role);
  const canWrite = hasRole('ADMIN', 'MANAGER', 'HR');
  const isAdmin = hasRole('ADMIN');

  return (
    <Ctx.Provider value={{ user, loading, login, logout, refreshUser, hasRole, canWrite, isAdmin }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth required');
  return v;
}
