import { NextResponse } from 'next/server';
import { setAuthCookies } from '@/lib/auth-cookies';
import { nestApi } from '@/lib/nest-api';

/** Admin login step 2: verify the TOTP code against the challenge token. */
export async function POST(req: Request): Promise<NextResponse> {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 });

  const res = await nestApi('/api/auth/admin/2fa/verify', { method: 'POST', body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return NextResponse.json(data, { status: res.status });

  await setAuthCookies(data.accessToken, data.refreshToken, data.expiresIn);
  return NextResponse.json({ user: data.user });
}