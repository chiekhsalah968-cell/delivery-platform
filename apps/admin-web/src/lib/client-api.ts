'use client';

export interface ApiResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
  fieldErrors?: Record<string, string>;
}

/** Calls the authenticated admin BFF proxy. Tokens stay in httpOnly cookies. */
export async function api<T = unknown>(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<ApiResult<T>> {
  let res: Response;
  try {
    res = await fetch(`/api/proxy/${path}`, {
      method,
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    });
  } catch {
    return { ok: false, status: 0, error: 'Network error' };
  }

  const data = await res.json().catch(() => ({}) as Record<string, unknown>);
  if (res.ok) return { ok: true, status: res.status, data: data as T };

  const fieldErrors: Record<string, string> = {};
  const errors = (data as { errors?: { path: string; message: string }[] }).errors;
  if (Array.isArray(errors)) for (const e of errors) fieldErrors[e.path] = e.message;
  return {
    ok: false,
    status: res.status,
    error: (data as { message?: string }).message ?? 'Request failed',
    fieldErrors,
  };
}