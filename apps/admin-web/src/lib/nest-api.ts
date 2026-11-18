/** Base URL of the NestJS API. Server-side only — never exposed to the browser. */
const API_URL = process.env.API_URL ?? 'http://localhost:3002';

/** Thin fetch wrapper for the NestJS API used by the BFF route handlers. */
export function nestApi(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
    cache: 'no-store',
  });
}