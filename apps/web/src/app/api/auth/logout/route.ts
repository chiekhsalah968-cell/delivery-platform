import { NextResponse } from 'next/server';
import { clearAuthCookies, readAuthCookies } from '@/lib/auth-cookies';
import { nestApi } from '@/lib/nest-api';

export async function POST(): Promise<NextResponse> {
  const { refresh } = await readAuthCookies();
  if (refresh) {
    await nestApi('/api/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken: refresh }),
    }).catch(() => undefined);
  }
  await clearAuthCookies();
  return NextResponse.json({ success: true });
}