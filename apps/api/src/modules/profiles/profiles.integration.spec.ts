import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../../app.module';
import { TokenService } from '../../common/token/token.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';

/**
 * M2 integration tests against live Postgres + Redis: geo reference data,
 * role profiles, courier vehicles, saved addresses, and admin approval.
 * All created users (and their cascaded profiles/vehicles/addresses) are removed.
 */
describe('Profiles / vehicles / addresses / admin (integration)', () => {
  let app: INestApplication;
  let base: string;
  let prisma: PrismaService;
  let redis: RedisService;
  let tokens: TokenService;
  const createdUserIds: string[] = [];
  let adminToken: string;

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

    const admin = await prisma.user.create({
      data: {
        phone: `+213550${Math.floor(100000 + Math.random() * 900000)}`,
        passwordHash: 'integration-test-admin',
        role: 'admin',
        status: 'active',
      },
    });
    createdUserIds.push(admin.id);
    adminToken = await tokens.signAccess({ id: admin.id, role: 'admin' });
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

  async function register(role: 'customer' | 'merchant' | 'courier') {
    const res = await api('POST', '/api/auth/register', { phone: randomPhone(), password: 'Passw0rd!', role });
    createdUserIds.push(res.body.user.id);
    return { id: res.body.user.id as string, token: res.body.accessToken as string, status: res.body.user.status };
  }

  describe('geo', () => {
    it('lists 58 wilayas publicly', async () => {
      const res = await api('GET', '/api/geo/wilayas');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(58);
      expect(res.body[0]).toMatchObject({ code: 1, nameFr: 'Adrar' });
    });

    it('lists municipalities for a wilaya and 404s an unknown wilaya', async () => {
      const res = await api('GET', '/api/geo/wilayas/16/municipalities');
      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body.some((m: any) => m.nameFr === 'Alger Centre')).toBe(true);
      const missing = await api('GET', '/api/geo/wilayas/99/municipalities');
      expect(missing.status).toBe(404);
    });
  });

  describe('profiles', () => {
    it('upserts a customer profile and returns it from /profiles/me', async () => {
      const u = await register('customer');
      const put = await api('PUT', '/api/profiles/me/customer', { fullName: 'Amine Benali' }, u.token);
      expect(put.status).toBe(200);
      expect(put.body.fullName).toBe('Amine Benali');
      const me = await api('GET', '/api/profiles/me', undefined, u.token);
      expect(me.status).toBe(200);
      expect(me.body.role).toBe('customer');
      expect(me.body.customerProfile.fullName).toBe('Amine Benali');
      expect(me.body.merchantProfile).toBeNull();
    });

    it('upserts a merchant profile with geo and rejects a mismatched municipality', async () => {
      const u = await register('merchant');
      const muni = await api('GET', '/api/geo/wilayas/16/municipalities');
      const municipalityId = muni.body[0].id;
      const put = await api('PUT', '/api/profiles/me/merchant', {
        businessName: 'Épicerie El Baraka',
        wilayaCode: 16,
        municipalityId,
        addressLine: 'Rue Didouche Mourad',
        latitude: 36.75,
        longitude: 3.06,
      }, u.token);
      expect(put.status).toBe(200);
      expect(put.body.wilaya.code).toBe(16);
      expect(put.body.municipality.id).toBe(municipalityId);

      const bad = await api('PUT', '/api/profiles/me/merchant', {
        businessName: 'X',
        wilayaCode: 31,
        municipalityId,
        addressLine: 'X',
      }, u.token);
      expect(bad.status).toBe(400);
    });

    it('enforces role ownership of profile endpoints', async () => {
      const customer = await register('customer');
      const forbidden = await api('PUT', '/api/profiles/me/merchant', {
        businessName: 'X', wilayaCode: 16, addressLine: 'X',
      }, customer.token);
      expect(forbidden.status).toBe(403);
    });

    it('sets courier availability and location', async () => {
      const u = await register('courier');
      await api('PUT', '/api/profiles/me/courier', { fullName: 'Karim', wilayaCode: 16 }, u.token);
      const avail = await api('PATCH', '/api/profiles/me/courier/availability', { availability: 'online' }, u.token);
      expect(avail.status).toBe(200);
      expect(avail.body.availability).toBe('online');
      const loc = await api('PATCH', '/api/profiles/me/courier/location', { latitude: 36.75, longitude: 3.06 }, u.token);
      expect(loc.status).toBe(200);
      expect(loc.body.latitude).toBe(36.75);
      expect(loc.body.locationUpdatedAt).toBeTruthy();
    });

    it('rejects availability change before the courier profile exists', async () => {
      const u = await register('courier');
      const res = await api('PATCH', '/api/profiles/me/courier/availability', { availability: 'online' }, u.token);
      expect(res.status).toBe(404);
    });
  });

  describe('vehicles', () => {
    it('manages vehicles with default promotion and plate uniqueness', async () => {
      const u = await register('courier');
      await api('PUT', '/api/profiles/me/courier', { fullName: 'Karim', wilayaCode: 16 }, u.token);

      const v1 = await api('POST', '/api/vehicles', { type: 'motorcycle', plateNumber: '111111-116-16' }, u.token);
      expect(v1.status).toBe(201);
      expect(v1.body.isDefault).toBe(true);

      const v2 = await api('POST', '/api/vehicles', { type: 'car', plateNumber: '222222-116-16' }, u.token);
      expect(v2.status).toBe(201);
      expect(v2.body.isDefault).toBe(false);

      const dup = await api('POST', '/api/vehicles', { type: 'car', plateNumber: '111111-116-16' }, u.token);
      expect(dup.status).toBe(409);

      const setDefault = await api('PUT', `/api/vehicles/${v2.body.id}`, { type: 'car', plateNumber: '222222-116-16', isDefault: true }, u.token);
      expect(setDefault.status).toBe(200);
      const list = await api('GET', '/api/vehicles', undefined, u.token);
      expect(list.body.find((v: any) => v.id === v1.body.id).isDefault).toBe(false);
      expect(list.body.find((v: any) => v.id === v2.body.id).isDefault).toBe(true);

      const del = await api('DELETE', `/api/vehicles/${v2.body.id}`, undefined, u.token);
      expect(del.status).toBe(200);
      const after = await api('GET', '/api/vehicles', undefined, u.token);
      expect(after.body).toHaveLength(1);
      expect(after.body[0].isDefault).toBe(true);
    });

    it('blocks vehicle creation before a courier profile and for non-couriers', async () => {
      const noProfile = await register('courier');
      const res = await api('POST', '/api/vehicles', { type: 'car', plateNumber: '333333-116-16' }, noProfile.token);
      expect(res.status).toBe(400);
      const customer = await register('customer');
      const forbidden = await api('GET', '/api/vehicles', undefined, customer.token);
      expect(forbidden.status).toBe(403);
    });

    it('does not allow touching another courier’s vehicle', async () => {
      const a = await register('courier');
      const b = await register('courier');
      await api('PUT', '/api/profiles/me/courier', { fullName: 'A', wilayaCode: 16 }, a.token);
      await api('PUT', '/api/profiles/me/courier', { fullName: 'B', wilayaCode: 16 }, b.token);
      const v = await api('POST', '/api/vehicles', { type: 'truck', plateNumber: '444444-116-16' }, a.token);
      const intruder = await api('DELETE', `/api/vehicles/${v.body.id}`, undefined, b.token);
      expect(intruder.status).toBe(404);
    });
  });

  describe('addresses', () => {
    it('manages addresses with default switching', async () => {
      const u = await register('customer');
      const a1 = await api('POST', '/api/addresses', { label: 'Home', wilayaCode: 16, addressLine: 'Cité 500' }, u.token);
      expect(a1.status).toBe(201);
      expect(a1.body.isDefault).toBe(true);
      const a2 = await api('POST', '/api/addresses', { label: 'Work', wilayaCode: 16, addressLine: 'Centre' }, u.token);
      expect(a2.body.isDefault).toBe(false);
      const upd = await api('PUT', `/api/addresses/${a2.body.id}`, { label: 'Work', wilayaCode: 16, addressLine: 'Centre', isDefault: true }, u.token);
      expect(upd.status).toBe(200);
      const list = await api('GET', '/api/addresses', undefined, u.token);
      expect(list.body.find((a: any) => a.id === a1.body.id).isDefault).toBe(false);
      const del = await api('DELETE', `/api/addresses/${a2.body.id}`, undefined, u.token);
      expect(del.status).toBe(200);
      const after = await api('GET', '/api/addresses', undefined, u.token);
      expect(after.body[0].isDefault).toBe(true);
    });
  });

  describe('admin', () => {
    it('rejects non-admin access with 403', async () => {
      const u = await register('customer');
      const res = await api('GET', '/api/admin/pending', undefined, u.token);
      expect(res.status).toBe(403);
    });

    it('lists pending applications and approves / rejects / reactivates', async () => {
      const merchant = await register('merchant');
      const courier = await register('courier');
      await api('PUT', '/api/profiles/me/merchant', { businessName: 'Shop', wilayaCode: 16, addressLine: 'Rue' }, merchant.token);

      const pending = await api('GET', '/api/admin/pending', undefined, adminToken);
      expect(pending.status).toBe(200);
      const ids = pending.body.map((u: any) => u.id);
      expect(ids).toContain(merchant.id);
      expect(ids).toContain(courier.id);
      const listedMerchant = pending.body.find((u: any) => u.id === merchant.id);
      expect(listedMerchant.merchantProfile.businessName).toBe('Shop');

      const approve = await api('POST', `/api/admin/users/${merchant.id}/approve`, {}, adminToken);
      expect(approve.status).toBe(201);
      expect(approve.body.status).toBe('active');

      const approveAgain = await api('POST', `/api/admin/users/${merchant.id}/approve`, {}, adminToken);
      expect(approveAgain.status).toBe(400);

      const reject = await api('POST', `/api/admin/users/${courier.id}/reject`, { reason: 'Incomplete documents' }, adminToken);
      expect(reject.status).toBe(201);
      expect(reject.body.status).toBe('suspended');

      const reactivate = await api('POST', `/api/admin/users/${courier.id}/reactivate`, {}, adminToken);
      expect(reactivate.status).toBe(201);
      expect(reactivate.body.status).toBe('active');
    });

    it('filters users by role and status', async () => {
      const res = await api('GET', '/api/admin/users?role=courier&status=active', undefined, adminToken);
      expect(res.status).toBe(200);
      expect(res.body.every((u: any) => u.role === 'courier' && u.status === 'active')).toBe(true);
    });
  });
});