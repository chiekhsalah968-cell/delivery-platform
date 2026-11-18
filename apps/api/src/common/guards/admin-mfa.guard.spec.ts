import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { AdminMfaGuard } from './admin-mfa.guard';

function ctxWithUser(user: unknown) {
  return { switchToHttp: () => ({ getRequest: () => ({ user }) }) } as never;
}

describe('AdminMfaGuard', () => {
  const guard = new AdminMfaGuard();

  it('allows anonymous (public) requests', () => {
    expect(guard.canActivate(ctxWithUser(undefined))).toBe(true);
  });

  it('allows non-admin users', () => {
    expect(guard.canActivate(ctxWithUser({ role: 'customer', totpEnabled: false, amr: ['pwd'] }))).toBe(true);
  });

  it('allows an admin who has not enrolled in 2FA', () => {
    expect(guard.canActivate(ctxWithUser({ role: 'admin', totpEnabled: false, amr: ['pwd'] }))).toBe(true);
  });

  it('allows an admin with a 2FA-authenticated session', () => {
    expect(guard.canActivate(ctxWithUser({ role: 'admin', totpEnabled: true, amr: ['pwd', 'totp'] }))).toBe(true);
  });

  it('rejects an admin with 2FA enabled but a password-only session', () => {
    expect(() => guard.canActivate(ctxWithUser({ role: 'admin', totpEnabled: true, amr: ['pwd'] }))).toThrow(
      ForbiddenException,
    );
  });
});