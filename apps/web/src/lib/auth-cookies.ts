import { cookies } from 'next/headers';

export const ACCESS_COOKIE = 'dp_access';
export const REFRESH_COOKIE = 'dp_refresh';

const REFRESH_MAX_AGE = 60 * 60 * 24 * 30; // 30 days, matches API REFRESH_TOKEN_TTL_S
const secure = process.env.NODE_ENV === 'production';

/** Stores tokens in httpOnly cookies so client-side JS cannot read them (XSS-safe). */
export async function setAuthCookies(
  accessToken: string,
  refreshToken: string,
  accessMaxAge: number,
): Promise<void> {
  const store = await cookies();
  store.set(ACCESS_COOKIE, accessToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: accessMaxAge,
  });
  store.set(REFRESH_COOKIE, refreshToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: REFRESH_MAX_AGE,
  });
}

export async function clearAuthCookies(): Promise<void> {
  const store = await cookies();
  store.delete(ACCESS_COOKIE);
  store.delete(REFRESH_COOKIE);
}

export async function readAuthCookies(): Promise<{ access?: string; refresh?: string }> {
  const store = await cookies();
  return {
    access: store.get(ACCESS_COOKIE)?.value,
    refresh: store.get(REFRESH_COOKIE)?.value,
  };
}