import { NextResponse } from 'next/server';
import { clearAuthCookies, readAuthCookies, setAuthCookies } from '@/lib/auth-cookies';
import { nestApi } from '@/lib/nest-api';

/**
 * Resolves the current user from the httpOnly cookies. If the access token is
 * missing/expired, silently rotates the refresh token (allowed here because this
 * is a route handler, not an RSC render) and retries.
 */
export async function GET(): Promise<NextResponse> {
  const { access, refresh } = await readAuthCookies();

  if (access) {
    const me = await nestApi('/api/auth/me', { headers: { Authorization: `Bearer ${access}` } });
    if (me.ok) return NextResponse.json({ user: await me.json() });
  }

  if (refresh) {
    const rotated = await nestApi('/api/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken: refresh }),
    });
    if (rotated.ok) {
      const tokens = await rotated.json();
      await setAuthCookies(tokens.accessToken, tokens.refreshToken, tokens.expiresIn);
      const me = await nestApi('/api/auth/me', {
        headers: { Authorization: `Bearer ${tokens.accessToken}` },
      });
      if (me.ok) return NextResponse.json({ user: await me.json() });
    } else {
      await clearAuthCookies();
    }
  }

  return NextResponse.json({ user: null }, { status: 401 });
}