import {
  ConflictException,
  ForbiddenException,
  HttpException,
  UnauthorizedException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@delivery/db';
import { AuditService } from '../../common/audit/audit.service';
import { TokenService } from '../../common/token/token.service';
import { TotpService } from '../../common/totp/totp.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { AuthService } from './auth.service';

vi.mock('./password', () => ({
  hashPassword: vi.fn(async (plain: string) => `hashed:${plain}`),
  verifyPassword: vi.fn(async (hash: string, plain: string) => hash === `hashed:${plain}`),
  getDummyHash: vi.fn(async () => 'hashed:dummy'),
}));

const ctx = { ip: '127.0.0.1', userAgent: 'vitest' };

function fakeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'u1',
    phone: '+213550123456',
    email: null,
    passwordHash: 'hashed:Passw0rd!',
    role: 'customer',
    status: 'active',
    locale: 'ar',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

function buildMocks() {
  const prisma = {
    user: { findUnique: vi.fn(), create: vi.fn() },
    refreshToken: {
      findUnique: vi.fn(),
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    $transaction: vi.fn(async (ops: unknown) => (Array.isArray(ops) ? Promise.all(ops) : ops)),
  };
  const tokens = {
    accessTtl: 900,
    refreshTtl: 2592000,
    signAccess: vi.fn().mockResolvedValue('access-token'),
    signRefresh: vi.fn().mockResolvedValue('refresh-token'),
    signMfaChallenge: vi.fn().mockResolvedValue('mfa-challenge'),
    verifyRefresh: vi.fn(),
    verifyMfaChallenge: vi.fn(),
    hashToken: vi.fn(() => 'token-hash'),
  };
  const audit = { log: vi.fn().mockResolvedValue(undefined) };
  const redis = {
    client: {
      get: vi.fn().mockResolvedValue(null),
      incr: vi.fn().mockResolvedValue(1),
      expire: vi.fn().mockResolvedValue(1),
      ttl: vi.fn().mockResolvedValue(900),
      del: vi.fn().mockResolvedValue(1),
    },
  };
  const totp = {
    generateSecret: vi.fn(() => 'TOTPSECRET'),
    keyuri: vi.fn(() => 'otpauth://totp/Delivery Platform Admin:u1?secret=TOTPSECRET'),
    verify: vi.fn(() => true),
  };
  return { prisma, tokens, audit, redis, totp };
}

async function createService(mocks: ReturnType<typeof buildMocks>) {
  const moduleRef = await Test.createTestingModule({
    providers: [
      AuthService,
      { provide: PrismaService, useValue: mocks.prisma },
      { provide: TokenService, useValue: mocks.tokens },
      { provide: AuditService, useValue: mocks.audit },
      { provide: RedisService, useValue: mocks.redis },
      { provide: TotpService, useValue: mocks.totp },
    ],
  }).compile();
  return moduleRef.get(AuthService);
}

describe('AuthService (unit)', () => {
  let mocks: ReturnType<typeof buildMocks>;
  let service: AuthService;

  beforeEach(async () => {
    mocks = buildMocks();
    service = await createService(mocks);
  });

  describe('register', () => {
    it('creates an active customer, issues tokens, and audits', async () => {
      mocks.prisma.user.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) =>
        fakeUser(data),
      );
      const result = await service.register(
        { phone: '0550123456', password: 'Passw0rd!', role: 'customer' },
        ctx,
      );
      expect(result.user.status).toBe('active');
      expect(result.user.phone).toBe('+213550123456');
      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('refresh-token');
      expect(result.user).not.toHaveProperty('passwordHash');
      expect(mocks.prisma.refreshToken.create).toHaveBeenCalledOnce();
      expect(mocks.audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'auth.register', entity: 'user' }),
      );
    });

    it('creates merchants and couriers as pending (await approval)', async () => {
      mocks.prisma.user.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) =>
        fakeUser(data),
      );
      const merchant = await service.register(
        { phone: '0550123456', password: 'Passw0rd!', role: 'merchant' },
        ctx,
      );
      const courier = await service.register(
        { phone: '0550123457', password: 'Passw0rd!', role: 'courier' },
        ctx,
      );
      expect(merchant.user.status).toBe('pending');
      expect(courier.user.status).toBe('pending');
    });

    it('maps a unique-constraint violation to 409 Conflict', async () => {
      mocks.prisma.user.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('dup', {
          code: 'P2002',
          clientVersion: '6.19.3',
          meta: { target: ['phone'] },
        }),
      );
      await expect(
        service.register({ phone: '0550123456', password: 'Passw0rd!', role: 'customer' }, ctx),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('login', () => {
    it('issues tokens for valid credentials', async () => {
      mocks.prisma.user.findUnique.mockResolvedValue(fakeUser());
      const result = await service.login({ identifier: '0550123456', password: 'Passw0rd!' }, ctx);
      expect(result.accessToken).toBe('access-token');
      expect(mocks.audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'auth.login.success' }),
      );
    });

    it('rejects a wrong password with 401 and audits the failure', async () => {
      mocks.prisma.user.findUnique.mockResolvedValue(fakeUser());
      await expect(
        service.login({ identifier: '0550123456', password: 'Wrong123' }, ctx),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(mocks.audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'auth.login.failed' }),
      );
    });

    it('rejects an unknown account with 401 (timing-equalized)', async () => {
      mocks.prisma.user.findUnique.mockResolvedValue(null);
      await expect(
        service.login({ identifier: '0550123456', password: 'Passw0rd!' }, ctx),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects a suspended account with 403', async () => {
      mocks.prisma.user.findUnique.mockResolvedValue(fakeUser({ status: 'suspended' }));
      await expect(
        service.login({ identifier: '0550123456', password: 'Passw0rd!' }, ctx),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('refresh', () => {
    const stored = {
      id: 't1',
      userId: 'u1',
      familyId: 'f1',
      tokenHash: 'token-hash',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 100000),
    };

    it('rotates the token atomically and audits', async () => {
      mocks.tokens.verifyRefresh.mockResolvedValue({
        sub: 'u1',
        familyId: 'f1',
        jti: 't1',
        type: 'refresh',
      });
      mocks.prisma.refreshToken.findUnique.mockResolvedValue(stored);
      mocks.prisma.user.findUnique.mockResolvedValue(fakeUser());
      const result = await service.refresh('refresh-token', ctx);
      expect(result.accessToken).toBe('access-token');
      expect(mocks.prisma.$transaction).toHaveBeenCalledOnce();
      expect(mocks.prisma.refreshToken.update).toHaveBeenCalled();
      expect(mocks.prisma.refreshToken.create).toHaveBeenCalled();
      expect(mocks.audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'auth.refresh' }),
      );
    });

    it('detects reuse of a revoked token and revokes the whole family', async () => {
      mocks.tokens.verifyRefresh.mockResolvedValue({
        sub: 'u1',
        familyId: 'f1',
        jti: 't1',
        type: 'refresh',
      });
      mocks.prisma.refreshToken.findUnique.mockResolvedValue({
        ...stored,
        revokedAt: new Date(),
      });
      await expect(service.refresh('refresh-token', ctx)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(mocks.prisma.refreshToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { familyId: 'f1', revokedAt: null } }),
      );
      expect(mocks.audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'auth.refresh.reuse_detected' }),
      );
    });

    it('rejects an invalid signature with 401', async () => {
      mocks.tokens.verifyRefresh.mockRejectedValue(new Error('bad signature'));
      await expect(service.refresh('refresh-token', ctx)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('preserves the 2FA authentication strength (amr) across rotation', async () => {
      mocks.tokens.verifyRefresh.mockResolvedValue({
        sub: 'u1',
        familyId: 'f1',
        jti: 't1',
        type: 'refresh',
        amr: ['pwd', 'totp'],
      });
      mocks.prisma.refreshToken.findUnique.mockResolvedValue(stored);
      mocks.prisma.user.findUnique.mockResolvedValue(fakeUser({ role: 'admin', totpEnabled: true }));
      await service.refresh('refresh-token', ctx);
      expect(mocks.tokens.signAccess).toHaveBeenCalledWith(
        expect.objectContaining({ role: 'admin' }),
        ['pwd', 'totp'],
      );
      expect(mocks.tokens.signRefresh).toHaveBeenCalledWith(
        expect.objectContaining({ amr: ['pwd', 'totp'] }),
      );
    });
  });

  describe('logout', () => {
    it('revokes the family and is idempotent for invalid tokens', async () => {
      mocks.tokens.verifyRefresh.mockResolvedValue({ sub: 'u1', familyId: 'f1', jti: 't1' });
      mocks.prisma.refreshToken.findUnique.mockResolvedValue({ id: 't1', userId: 'u1', familyId: 'f1' });
      await expect(service.logout('refresh-token', ctx)).resolves.toEqual({ success: true });
      expect(mocks.prisma.refreshToken.updateMany).toHaveBeenCalled();

      mocks.tokens.verifyRefresh.mockRejectedValue(new Error('expired'));
      await expect(service.logout('expired-token', ctx)).resolves.toEqual({ success: true });
    });
  });

  describe('admin auth', () => {
    it('rejects admin accounts on the public login with 403', async () => {
      mocks.prisma.user.findUnique.mockResolvedValue(fakeUser({ role: 'admin' }));
      await expect(
        service.login({ identifier: '0550123456', password: 'Passw0rd!' }, ctx),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(mocks.audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'auth.login.admin_denied' }),
      );
    });

    it('admin login issues password-only tokens when 2FA is disabled', async () => {
      mocks.prisma.user.findUnique.mockResolvedValue(fakeUser({ role: 'admin', totpEnabled: false }));
      const res = await service.adminLogin({ identifier: '0550123456', password: 'Passw0rd!' }, ctx);
      expect(res.mfaRequired).toBe(false);
      expect(mocks.tokens.signAccess).toHaveBeenCalledWith(expect.objectContaining({ role: 'admin' }), ['pwd']);
    });

    it('admin login returns a 2FA challenge when enabled', async () => {
      mocks.prisma.user.findUnique.mockResolvedValue(fakeUser({ role: 'admin', totpEnabled: true, totpSecret: 'S' }));
      const res = await service.adminLogin({ identifier: '0550123456', password: 'Passw0rd!' }, ctx);
      expect(res.mfaRequired).toBe(true);
      if (res.mfaRequired) expect(res.mfaToken).toBe('mfa-challenge');
      expect(mocks.tokens.signMfaChallenge).toHaveBeenCalledWith('u1');
    });

    it('admin login rejects a non-admin account with 403', async () => {
      mocks.prisma.user.findUnique.mockResolvedValue(fakeUser({ role: 'customer' }));
      await expect(
        service.adminLogin({ identifier: '0550123456', password: 'Passw0rd!' }, ctx),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('admin login rejects a wrong password and records a failure', async () => {
      mocks.prisma.user.findUnique.mockResolvedValue(fakeUser({ role: 'admin' }));
      await expect(
        service.adminLogin({ identifier: '0550123456', password: 'Wrong123' }, ctx),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(mocks.redis.client.incr).toHaveBeenCalled();
    });

    it('admin login blocks a locked-out account with 429', async () => {
      mocks.prisma.user.findUnique.mockResolvedValue(fakeUser({ role: 'admin' }));
      mocks.redis.client.get.mockResolvedValue('5');
      const err = await service
        .adminLogin({ identifier: '0550123456', password: 'Passw0rd!' }, ctx)
        .catch((e) => e);
      expect(err).toBeInstanceOf(HttpException);
      expect(err.getStatus()).toBe(429);
    });

    it('verifies a TOTP code and issues 2FA tokens', async () => {
      mocks.tokens.verifyMfaChallenge.mockResolvedValue({ sub: 'u1', type: 'mfa', scope: 'admin_login' });
      mocks.prisma.user.findUnique.mockResolvedValue(fakeUser({ role: 'admin', totpEnabled: true, totpSecret: 'S' }));
      mocks.totp.verify.mockReturnValue(true);
      const res = await service.adminVerifyMfa({ mfaToken: 'mfa-challenge', code: '123456' }, ctx);
      expect(res.accessToken).toBe('access-token');
      expect(mocks.tokens.signAccess).toHaveBeenCalledWith(expect.objectContaining({ role: 'admin' }), ['pwd', 'totp']);
    });

    it('rejects an invalid TOTP code and records a failure', async () => {
      mocks.tokens.verifyMfaChallenge.mockResolvedValue({ sub: 'u1', type: 'mfa', scope: 'admin_login' });
      mocks.prisma.user.findUnique.mockResolvedValue(fakeUser({ role: 'admin', totpEnabled: true, totpSecret: 'S' }));
      mocks.totp.verify.mockReturnValue(false);
      await expect(
        service.adminVerifyMfa({ mfaToken: 'mfa-challenge', code: '000000' }, ctx),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(mocks.redis.client.incr).toHaveBeenCalled();
    });

    it('rejects an invalid 2FA challenge token', async () => {
      mocks.tokens.verifyMfaChallenge.mockRejectedValue(new Error('expired'));
      await expect(
        service.adminVerifyMfa({ mfaToken: 'bad-token', code: '123456' }, ctx),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });
});