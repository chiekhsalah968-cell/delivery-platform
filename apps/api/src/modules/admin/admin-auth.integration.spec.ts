import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { authenticator } from 'otplib';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../../app.module';
import { TokenService } from '../../common/token/token.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { hashPassword } from '../auth/password';

/**
 * Integration tests for the dedicated admin auth flow, TOTP 2FA enrollment and
 * enforcement, and admin-only settings/audit/stats. Boots the real AppModule
 * against live Postgres + Redis. All created users and settings are removed.
 */
describe('Admin auth / 2FA / settings (integration)', () => {
  let app: INestApplication;
  let base: string;
  let prisma: PrismaService;
  let redis: RedisService;
  let tokens: TokenService;
  const createdUserIds: string[] = [];
  const createdSettingKeys: string[] = [];
  const PASSWORD = 'Passw0rd!';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api', { exclude: ['health'] });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    await app.listen(0);
    base = (await app.getUrl()).replace('[::1]', '127.0.0.1');
    prisma = app.get(PrismaService);
    redis = app.get(RedisService);
    tokens = app.get(TokenService);
  });

  afterAll(async () => {
    if (createdSettingKeys.length > 0) {
      await prisma.adminSetting.deleteMany({ where: { key: { in: createdSettingKeys } } });
    }
    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    await app.close();
  });

  beforeEach(async () => {
    const keys = await redis.client.keys('rl:*');
    const lockKeys = await redis.client.keys('admin:fail:*');
    const all = [...keys, ...lockKeys];
    if (all.length > 0) await redis.client.del(...all);
  });

  function randomPhone(): string {
    return `0550${Math.floor(100000 + Math.random() * 900000)}`;
  }

  async function api(method: string, path: string, body?: unknown, token?: string) {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let parsed: Record<string, any>;
    try {
      parsed = text ? JSON.parse(text) : {};
    } catch {
      parsed = { raw: text };
    }
    return { status: res.status, body: parsed };
  }

  async function createAdmin(opts: { totpSecret?: string; totpEnabled?: boolean } = {}) {
    const phone = `+213550${Math.floor(100000 + Math.random() * 900000)}`;
    const admin = await prisma.user.create({
      data: {
        phone,
        passwordHash: await hashPassword(PASSWORD),
        role: 'admin',
        status: 'active',
        totpSecret: opts.totpSecret ?? null,
        totpEnabled: opts.totpEnabled ?? false,
      },
    });
    createdUserIds.push(admin.id);
    const token = await tokens.signAccess({ id: admin.id, role: 'admin' });
    return { id: admin.id, phone, token };
  }

  async function registerCustomer() {
    const res = await api('POST', '/api/auth/register', { phone: randomPhone(), password: PASSWORD, role: 'customer' });
    createdUserIds.push(res.body.user.id);
    return { id: res.body.user.id as string, phone: res.body.user.phone as string, token: res.body.accessToken as string };
  }

  it('rejects admin login through the public endpoint with 403', async () => {
    const admin = await createAdmin();
    const res = await api('POST', '/api/auth/login', { identifier: admin.phone, password: PASSWORD });
    expect(res.status).toBe(403);
  });

  it('admin login without 2FA returns password-only tokens', async () => {
    const admin = await createAdmin();
    const res = await api('POST', '/api/auth/admin/login', { identifier: admin.phone, password: PASSWORD });
    expect(res.status).toBe(201);
    expect(res.body.mfaRequired).toBe(false);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.user.role).toBe('admin');
  });

  it('admin login rejects a non-admin account with 403', async () => {
    const customer = await registerCustomer();
    const res = await api('POST', '/api/auth/admin/login', { identifier: customer.phone, password: PASSWORD });
    expect(res.status).toBe(403);
  });

  it('admin login rejects a wrong password with 401', async () => {
    const admin = await createAdmin();
    const res = await api('POST', '/api/auth/admin/login', { identifier: admin.phone, password: 'Wrong123!' });
    expect(res.status).toBe(401);
  });

  it('enrolls 2FA and then rejects the old password-only session', async () => {
    const admin = await createAdmin();
    const setup = await api('POST', '/api/admin/2fa/setup', {}, admin.token);
    expect(setup.status).toBe(201);
    expect(setup.body.secret).toBeTruthy();
    expect(setup.body.otpauthUrl).toContain('otpauth://');

    const code = authenticator.generate(setup.body.secret);
    const enable = await api('POST', '/api/admin/2fa/enable', { code }, admin.token);
    expect(enable.status).toBe(201);
    expect(enable.body.enabled).toBe(true);

    // The password-only session must now be rejected because 2FA is enabled.
    const stats = await api('GET', '/api/admin/stats', undefined, admin.token);
    expect(stats.status).toBe(403);
  });

  it('admin login with 2FA requires a valid TOTP code and grants a 2FA session', async () => {
    const secret = authenticator.generateSecret();
    const admin = await createAdmin({ totpSecret: secret, totpEnabled: true });

    const login = await api('POST', '/api/auth/admin/login', { identifier: admin.phone, password: PASSWORD });
    expect(login.status).toBe(201);
    expect(login.body.mfaRequired).toBe(true);
    expect(login.body.mfaToken).toBeTruthy();

    const bad = await api('POST', '/api/auth/admin/2fa/verify', { mfaToken: login.body.mfaToken, code: '000000' });
    expect(bad.status).toBe(401);

    const code = authenticator.generate(secret);
    const verify = await api('POST', '/api/auth/admin/2fa/verify', { mfaToken: login.body.mfaToken, code });
    expect(verify.status).toBe(201);
    expect(verify.body.accessToken).toBeTruthy();

    const stats = await api('GET', '/api/admin/stats', undefined, verify.body.accessToken);
    expect(stats.status).toBe(200);
    expect(stats.body.users.total).toBeGreaterThan(0);
  });

  it('exposes settings, audit and stats to admins only', async () => {
    const customer = await registerCustomer();
    const admin = await createAdmin();
    const key = 'platform.pricing';
    createdSettingKeys.push(key);

    expect((await api('GET', '/api/admin/settings', undefined, customer.token)).status).toBe(403);
    expect((await api('GET', '/api/admin/audit', undefined, customer.token)).status).toBe(403);
    expect((await api('GET', '/api/admin/stats', undefined, customer.token)).status).toBe(403);
    expect((await api('PUT', `/api/admin/settings/${key}`, { value: { commissionRate: 0.2 } }, customer.token)).status).toBe(403);

    const put = await api('PUT', `/api/admin/settings/${key}`, { value: { commissionRate: 0.15, baseDeliveryFee: 300 } }, admin.token);
    expect(put.status).toBe(200);
    expect(put.body.value.commissionRate).toBe(0.15);

    const get = await api('GET', `/api/admin/settings/${key}`, undefined, admin.token);
    expect(get.status).toBe(200);
    expect(get.body.value.baseDeliveryFee).toBe(300);

    const list = await api('GET', '/api/admin/settings', undefined, admin.token);
    expect(list.status).toBe(200);
    expect(list.body.some((s: any) => s.key === key)).toBe(true);

    const audit = await api('GET', '/api/admin/audit?limit=5', undefined, admin.token);
    expect(audit.status).toBe(200);
    expect(Array.isArray(audit.body)).toBe(true);

    const badKey = await api('PUT', '/api/admin/settings/Bad%20Key!', { value: {} }, admin.token);
    expect(badKey.status).toBe(400);
  });
});