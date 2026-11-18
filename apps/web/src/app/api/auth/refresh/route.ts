import { NextResponse } from 'next/server';
import { clearAuthCookies, readAuthCookies, setAuthCookies } from '@/lib/auth-cookies';
import { nestApi } from '@/lib/nest-api';

export async function POST(): Promise<NextResponse> {
  const { refresh } = await readAuthCookies();
  if (!refresh) return NextResponse.json({ message: 'No refresh token' }, { status: 401 });

  const res = await nestApi('/api/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken: refresh }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    await clearAuthCookies();
    return NextResponse.json(data, { status: res.status });
  }

  await setAuthCookies(data.accessToken, data.refreshToken, data.expiresIn);
  return NextResponse.json({ success: true });
}