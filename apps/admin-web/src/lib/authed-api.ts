import { clearAuthCookies, readAuthCookies, setAuthCookies } from './auth-cookies';
import { nestApi } from './nest-api';

/**
 * Calls the NestJS API with the caller's httpOnly access cookie, silently
 * rotating the refresh token on a 401 and retrying once. Returns the upstream
 * Response so the BFF route can forward its status and body unchanged.
 * Authorization is still enforced by the API's RBAC + admin-MFA guards — the
 * proxy only attaches the admin's own token.
 */
export async function authedApi(path: string, init: RequestInit = {}): Promise<Response> {
  const { access, refresh } = await readAuthCookies();

  const withToken = (token: string) =>
    nestApi(path, {
      ...init,
      headers: { ...init.headers, Authorization: `Bearer ${token}` },
    });

  if (access) {
    const res = await withToken(access);
    if (res.status !== 401) return res;
  }

  if (refresh) {
    const rotated = await nestApi('/api/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken: refresh }),
    });
    if (rotated.ok) {
      const tokens = await rotated.json();
      await setAuthCookies(tokens.accessToken, tokens.refreshToken, tokens.expiresIn);
      return withToken(tokens.accessToken);
    }
    await clearAuthCookies();
  }

  return new Response(JSON.stringify({ message: 'Unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });
}