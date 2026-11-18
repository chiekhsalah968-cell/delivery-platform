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
import type { AuthUser } from '@delivery/shared';

export interface AuthResult {
  ok: boolean;
  status?: number;
  error?: string;
  fieldErrors?: Record<string, string>;
}

export interface AdminLoginResult extends AuthResult {
  mfaRequired?: boolean;
  mfaToken?: string;
}

interface AdminAuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (identifier: string, password: string) => Promise<AdminLoginResult>;
  verifyMfa: (mfaToken: string, code: string) => Promise<AuthResult>;
  logout: () => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

interface ErrorBody {
  message?: string;
  errors?: { path: string; message: string }[];
}

function failResult(status: number, data: ErrorBody): AuthResult {
  const fieldErrors: Record<string, string> = {};
  if (Array.isArray(data.errors)) {
    for (const e of data.errors) fieldErrors[e.path] = e.message;
  }
  return { ok: false, status, error: data.message ?? 'Request failed', fieldErrors };
}

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch('/api/auth/me', { cache: 'no-store' })
      .then(async (res) => {
        if (!active) return;
        if (res.ok) {
          const data = (await res.json()) as { user?: AuthUser };
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

  const login = useCallback(async (identifier: string, password: string): Promise<AdminLoginResult> => {
    let res: Response;
    try {
      res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password }),
      });
    } catch {
      return { ok: false, status: 0, error: 'Network error' };
    }
    const data = (await res.json().catch(() => ({}))) as ErrorBody & {
      mfaRequired?: boolean;
      mfaToken?: string;
      user?: AuthUser;
    };
    if (!res.ok) return failResult(res.status, data);
    if (data.mfaRequired) return { ok: true, mfaRequired: true, mfaToken: data.mfaToken };
    setUser(data.user ?? null);
    return { ok: true, mfaRequired: false };
  }, []);

  const verifyMfa = useCallback(async (mfaToken: string, code: string): Promise<AuthResult> => {
    let res: Response;
    try {
      res = await fetch('/api/auth/mfa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mfaToken, code }),
      });
    } catch {
      return { ok: false, status: 0, error: 'Network error' };
    }
    const data = (await res.json().catch(() => ({}))) as ErrorBody & { user?: AuthUser };
    if (!res.ok) return failResult(res.status, data);
    setUser(data.user ?? null);
    return { ok: true };
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, verifyMfa, logout }),
    [user, loading, login, verifyMfa, logout],
  );

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth(): AdminAuthContextValue {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  return ctx;
}