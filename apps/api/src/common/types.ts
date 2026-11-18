import type { Locale, Role, UserStatus } from '@delivery/shared';
import type { Request } from 'express';

/** The authenticated principal attached to the request by JwtAuthGuard. */
export interface AuthenticatedUser {
  id: string;
  phone: string;
  email: string | null;
  role: Role;
  status: UserStatus;
  locale: Locale;
  /** Authentication methods used for this session (e.g. ['pwd'], ['pwd','totp']). */
  amr: string[];
  /** Whether the account has TOTP 2FA enabled (loaded from the DB, not the token). */
  totpEnabled: boolean;
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}

/** Request metadata captured for audit logging. */
export interface RequestContext {
  ip?: string;
  userAgent?: string;
}

export function requestContext(req: Request): RequestContext {
  return {
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  };
}