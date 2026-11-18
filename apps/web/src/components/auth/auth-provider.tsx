'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { AuthUser, LoginInput, RegisterInput } from '@delivery/shared';

export interface AuthResult {
  ok: boolean;
  status?: number;
  error?: string;
  fieldErrors?: Record<string, string>;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (input: LoginInput) => Promise<AuthResult>;
  register: (input: RegisterInput) => Promise<AuthResult>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function toResult(res: Response): Promise<AuthResult> {
  const data = await res.json().catch(() => ({}) as Record<string, unknown>);
  const fieldErrors: Record<string, string> = {};
  const errors = (data as { errors?: { path: string; message: string }[] }).errors;
  if (Array.isArray(errors)) {
    for (const e of errors) fieldErrors[e.path] = e.message;
  }
  return {
    ok: false,
    status: res.status,
    error: (data as { message?: string }).message ?? 'Request failed',
    fieldErrors,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch('/api/auth/me', { cache: 'no-store' })
      .then(async (res) => {
        if (!active) return;
        if (res.ok) {
          const data = await res.json();
          setUser(data.user ?? null);
        } else {
          setUser(null);
        }
      })
      .catch(() => {
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (input: LoginInput): Promise<AuthResult> => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) return toResult(res);
    const data = await res.json();
    setUser(data.user);
    return { ok: true };
  }, []);

  const register = useCallback(async (input: RegisterInput): Promise<AuthResult> => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) return toResult(res);
    const data = await res.json();
    setUser(data.user);
    return { ok: true };
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, register, logout }),
    [user, loading, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}