import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { TokenService } from '../token/token.service';
import { JwtAuthGuard } from './jwt-auth.guard';

function contextWithAuth(header?: string) {
  const request: { headers: Record<string, string>; user?: unknown } = {
    headers: header ? { authorization: header } : {},
  };
  return {
    ctx: {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => request }),
    } as never,
    request,
  };
}

function build(isPublic: boolean, verify: unknown, findUnique: unknown) {
  const reflector = { getAllAndOverride: vi.fn().mockReturnValue(isPublic) } as unknown as Reflector;
  const tokens = { verifyAccess: verify } as unknown as TokenService;
  const prisma = { user: { findUnique } } as unknown as PrismaService;
  return new JwtAuthGuard(reflector, tokens, prisma);
}

describe('JwtAuthGuard', () => {
  it('skips authentication for @Public routes', async () => {
    const verify = vi.fn();
    const guard = build(true, verify, vi.fn());
    const { ctx } = contextWithAuth();
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(verify).not.toHaveBeenCalled();
  });

  it('rejects a missing bearer token', async () => {
    const guard = build(false, vi.fn(), vi.fn());
    const { ctx } = contextWithAuth();
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects an invalid token', async () => {
    const guard = build(false, vi.fn().mockRejectedValue(new Error('bad')), vi.fn());
    const { ctx } = contextWithAuth('Bearer abc');
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a non-access token type', async () => {
    const guard = build(
      false,
      vi.fn().mockResolvedValue({ sub: 'u1', type: 'refresh' }),
      vi.fn(),
    );
    const { ctx } = contextWithAuth('Bearer abc');
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('attaches the principal for a valid token', async () => {
    const user = {
      id: 'u1',
      phone: '+213550123456',
      email: null,
      role: 'customer',
      status: 'active',
      locale: 'ar',
    };
    const guard = build(
      false,
      vi.fn().mockResolvedValue({ sub: 'u1', type: 'access' }),
      vi.fn().mockResolvedValue(user),
    );
    const { ctx, request } = contextWithAuth('Bearer good');
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(request.user).toMatchObject({ id: 'u1', role: 'customer' });
  });

  it('rejects a suspended account with 403', async () => {
    const guard = build(
      false,
      vi.fn().mockResolvedValue({ sub: 'u1', type: 'access' }),
      vi.fn().mockResolvedValue({ id: 'u1', status: 'suspended', role: 'customer' }),
    );
    const { ctx } = contextWithAuth('Bearer good');
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects when the user no longer exists', async () => {
    const guard = build(
      false,
      vi.fn().mockResolvedValue({ sub: 'u1', type: 'access' }),
      vi.fn().mockResolvedValue(null),
    );
    const { ctx } = contextWithAuth('Bearer good');
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});