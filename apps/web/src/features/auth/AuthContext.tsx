import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';

export interface User { id: string; email: string; name: string; role: 'LANDLORD' | 'ADMIN' }
interface Ctx { user: User | null; loading: boolean; login: (e: string, p: string) => Promise<void>; register: (n: string, e: string, p: string) => Promise<void>; logout: () => Promise<void>; setUser: (u: User) => void }

const AuthContext = createContext<Ctx>(null as never);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const qc = useQueryClient();

  useEffect(() => {
    api<User>('/auth/me').then((r) => setUser(r.data)).catch(() => setUser(null)).finally(() => setLoading(false));
    const expired = () => { setUser(null); qc.clear(); };
    window.addEventListener('auth:expired', expired);
    return () => window.removeEventListener('auth:expired', expired);
  }, [qc]);

  const login = useCallback(async (email: string, password: string) => { qc.clear(); setUser((await api<User>('/auth/login', { method: 'POST', body: { email, password } })).data); }, [qc]);
  const register = useCallback(async (name: string, email: string, password: string) => { qc.clear(); setUser((await api<User>('/auth/register', { method: 'POST', body: { name, email, password } })).data); }, [qc]);
  const logout = useCallback(async () => { await api('/auth/logout', { method: 'POST' }).catch(() => undefined); setUser(null); qc.clear(); }, [qc]);

  return <AuthContext.Provider value={{ user, loading, login, register, logout, setUser }}>{children}</AuthContext.Provider>;
}
