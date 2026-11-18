import type { AuthResult } from './auth-provider';

/** Maps an API failure to a localized, user-facing message (never raw server text). */
export function authErrorMessage(res: AuthResult, t: (key: string) => string): string {
  switch (res.status) {
    case 401:
      return t('errors.invalidCredentials');
    case 403:
      return t('errors.suspended');
    case 409:
      return t('errors.conflict');
    case 429:
      return t('errors.rateLimited');
    default:
      return t('errors.generic');
  }
}

/** Localizes a field error by path, falling back to the server-provided message. */
export function fieldError(
  fieldErrors: Record<string, string> | undefined,
  path: string,
  t: (key: string) => string,
): string | undefined {
  const raw = fieldErrors?.[path];
  if (!raw) return undefined;
  const key = `validation.${path}`;
  const translated = t(key);
  return translated === key ? raw : translated;
}