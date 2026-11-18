import { NextResponse } from 'next/server';
import { clearAuthCookies, readAuthCookies, setAuthCookies } from '@/lib/auth-cookies';
import { nestApi } from '@/lib/nest-api';

/**
 * Resolves the current admin from the httpOnly cookies. If the access token is
 * missing/expired, silently rotates the refresh token (preserving the 2FA amr)
 * and retries. A 403 here means the session lacks required 2FA — treated as
 * signed-out so the UI redirects to the admin login.
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