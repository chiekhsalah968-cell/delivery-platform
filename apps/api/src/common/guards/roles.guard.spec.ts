import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';
import { RolesGuard } from './roles.guard';

function contextWithUser(user: unknown) {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as never;
}

describe('RolesGuard', () => {
  it('allows when no roles are required', () => {
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(undefined) } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(contextWithUser(undefined))).toBe(true);
  });

  it('allows a user whose role is permitted', () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue(['merchant', 'admin']),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(contextWithUser({ role: 'merchant' }))).toBe(true);
  });

  it('denies a user whose role is not permitted', () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue(['admin']),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(() => guard.canActivate(contextWithUser({ role: 'customer' }))).toThrow(
      ForbiddenException,
    );
  });

  it('denies when roles are required but no user is present', () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue(['admin']),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(() => guard.canActivate(contextWithUser(undefined))).toThrow(ForbiddenException);
  });
});