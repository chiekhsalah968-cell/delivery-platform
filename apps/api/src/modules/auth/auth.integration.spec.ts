import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../../app.module';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';

/**
 * Full-stack integration tests against the live local Postgres + Redis.
 * Boots the real AppModule (guards, pipes, Prisma, Redis) on an ephemeral port.
 * Test users are tracked and removed afterwards; rate-limit keys are reset
 * before each test so windows do not leak across cases.
 */
describe('Auth API (integration)', () => {
  let app: INestApplication;
  let base: string;
  let prisma: PrismaService;
  let redis: RedisService;
  const createdUserIds: string[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api', { exclude: ['health'] });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
    await app.listen(0);
    base = (await app.getUrl()).replace('[::1]', '127.0.0.1');
    prisma = app.get(PrismaService);
    redis = app.get(RedisService);
  });

  afterAll(async () => {
    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    await app.close();
  });

  beforeEach(async () => {
    const keys = await redis.client.keys('rl:*');
    if (keys.length > 0) await redis.client.del(...keys);
  });

  function randomPhone(): string {
    return `0550${Math.floor(100000 + Math.random() * 900000)}`;
  }

  async function api(
    method: string,
    path: string,
    body?: unknown,
    token?: string,
  ): Promise<{ status: number; body: Record<string, any> }> {
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

  async function registerCustomer(overrides: Record<string, unknown> = {}) {
    const phone = randomPhone();
    const res = await api('POST', '/api/auth/register', {
      phone,
      password: 'Passw0rd!',
      role: 'customer',
      ...overrides,
    });
    if (res.body?.user?.id) createdUserIds.push(res.body.user.id);
    return { phone, res };
  }

  it('health probe is public and reports ok', async () => {
    const res = await api('GET', '/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('registers a customer and returns tokens without leaking the password hash', async () => {
    const { res } = await registerCustomer();
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('customer');
    expect(res.body.user.status).toBe('active');
    expect(res.body.user.phone).toMatch(/^\+213550\d{6}$/);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.refreshToken).toBeTruthy();
    expect(res.body.tokenType).toBe('Bearer');
    expect(res.body.user).not.toHaveProperty('passwordHash');
  });

  it('GET /me returns the principal with a valid token and 401 without', async () => {
    const { res } = await registerCustomer();
    const me = await api('GET', '/api/auth/me', undefined, res.body.accessToken);
    expect(me.status).toBe(200);
    expect(me.body.id).toBe(res.body.user.id);
    const anon = await api('GET', '/api/auth/me');
    expect(anon.status).toBe(401);
  });

  it('rejects a duplicate phone with 409', async () => {
    const { phone } = await registerCustomer();
    const dup = await api('POST', '/api/auth/register', {
      phone,
      password: 'Passw0rd!',
      role: 'customer',
    });
    expect(dup.status).toBe(409);
  });

  it('rejects admin self-registration, invalid phone, and weak password with 400', async () => {
    const admin = await api('POST', '/api/auth/register', {
      phone: randomPhone(),
      password: 'Passw0rd!',
      role: 'admin',
    });
    expect(admin.status).toBe(400);
    const badPhone = await api('POST', '/api/auth/register', {
      phone: '+33612345678',
      password: 'Passw0rd!',
      role: 'customer',
    });
    expect(badPhone.status).toBe(400);
    const weak = await api('POST', '/api/auth/register', {
      phone: randomPhone(),
      password: '123',
      role: 'customer',
    });
    expect(weak.status).toBe(400);
  });

  it('registers merchants and couriers as pending', async () => {
    const merchant = await registerCustomer({ role: 'merchant' });
    const courier = await registerCustomer({ role: 'courier' });
    expect(merchant.res.body.user.status).toBe('pending');
    expect(courier.res.body.user.status).toBe('pending');
  });

  it('logs in with phone and with email', async () => {
    const email = `user${Math.floor(Math.random() * 1e6)}@example.dz`;
    const { phone, res } = await registerCustomer({ email });
    const byPhone = await api('POST', '/api/auth/login', {
      identifier: phone,
      password: 'Passw0rd!',
    });
    expect(byPhone.status).toBe(201);
    expect(byPhone.body.user.id).toBe(res.body.user.id);
    const byEmail = await api('POST', '/api/auth/login', {
      identifier: email,
      password: 'Passw0rd!',
    });
    expect(byEmail.status).toBe(201);
    expect(byEmail.body.accessToken).toBeTruthy();
  });

  it('rejects wrong password and unknown account with 401', async () => {
    const { phone } = await registerCustomer();
    const wrong = await api('POST', '/api/auth/login', { identifier: phone, password: 'Wrong123!' });
    expect(wrong.status).toBe(401);
    const unknown = await api('POST', '/api/auth/login', {
      identifier: randomPhone(),
      password: 'Passw0rd!',
    });
    expect(unknown.status).toBe(401);
  });

  it('rejects a suspended account with 403', async () => {
    const { phone, res } = await registerCustomer();
    await prisma.user.update({ where: { id: res.body.user.id }, data: { status: 'suspended' } });
    const login = await api('POST', '/api/auth/login', { identifier: phone, password: 'Passw0rd!' });
    expect(login.status).toBe(403);
  });

  it('rotates refresh tokens and detects reuse of a rotated token', async () => {
    const { res } = await registerCustomer();
    const original = res.body.refreshToken;

    const rotated = await api('POST', '/api/auth/refresh', { refreshToken: original });
    expect(rotated.status).toBe(201);
    expect(rotated.body.refreshToken).toBeTruthy();
    expect(rotated.body.refreshToken).not.toBe(original);

    // Reusing the original (now revoked) token must fail and revoke the family.
    const reuse = await api('POST', '/api/auth/refresh', { refreshToken: original });
    expect(reuse.status).toBe(401);

    // The successor is also revoked because the whole family was invalidated.
    const successor = await api('POST', '/api/auth/refresh', {
      refreshToken: rotated.body.refreshToken,
    });
    expect(successor.status).toBe(401);
  });

  it('logout revokes the family so refresh afterwards fails', async () => {
    const { res } = await registerCustomer();
    const out = await api('POST', '/api/auth/logout', { refreshToken: res.body.refreshToken });
    expect(out.status).toBe(201);
    expect(out.body.success).toBe(true);
    const after = await api('POST', '/api/auth/refresh', { refreshToken: res.body.refreshToken });
    expect(after.status).toBe(401);
  });

  it('rate-limits repeated login attempts with 429', async () => {
    const phone = randomPhone();
    const statuses: number[] = [];
    for (let i = 0; i < 11; i++) {
      const res = await api('POST', '/api/auth/login', { identifier: phone, password: 'Wrong123!' });
      statuses.push(res.status);
    }
    expect(statuses.slice(0, 10).every((s) => s === 401)).toBe(true);
    expect(statuses[10]).toBe(429);
  });
});