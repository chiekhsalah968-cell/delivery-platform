import { NextResponse } from 'next/server';
import { setAuthCookies } from '@/lib/auth-cookies';
import { nestApi } from '@/lib/nest-api';

/**
 * Admin login step 1. Calls the dedicated admin endpoint (never the public
 * login). When 2FA is enabled the API returns a short-lived challenge token and
 * no cookies are set yet; otherwise tokens are stored and the user is returned.
 */
export async function POST(req: Request): Promise<NextResponse> {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 });

  const res = await nestApi('/api/auth/admin/login', { method: 'POST', body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return NextResponse.json(data, { status: res.status });

  if (data.mfaRequired) {
    return NextResponse.json({ mfaRequired: true, mfaToken: data.mfaToken });
  }

  await setAuthCookies(data.accessToken, data.refreshToken, data.expiresIn);
  return NextResponse.json({ mfaRequired: false, user: data.user });
}