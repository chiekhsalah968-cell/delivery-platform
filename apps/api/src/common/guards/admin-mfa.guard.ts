import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '../types';

/**
 * Enforces two-factor authentication for admin sessions on the backend.
 * Runs after JwtAuthGuard/RolesGuard. Once an admin has TOTP enabled, every
 * request must carry a session authenticated with 'totp' (amr claim) — a
 * password-only session is rejected, so 2FA cannot be bypassed by the client.
 * Admins who have not yet enrolled (totpEnabled=false) may still authenticate
 * with a password so they can reach the enrollment endpoints.
 */
@Injectable()
export class AdminMfaGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    const user = request.user;
    if (user?.role === 'admin' && user.totpEnabled && !user.amr.includes('totp')) {
      throw new ForbiddenException('Two-factor authentication required');
    }
    return true;
  }
}