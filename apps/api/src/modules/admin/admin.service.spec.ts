import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuditService } from '../../common/audit/audit.service';
import { TotpService } from '../../common/totp/totp.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminService } from './admin.service';

const ctx = { ip: '127.0.0.1', userAgent: 'vitest' };

function buildMocks() {
  const prisma = {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
      groupBy: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
    adminSetting: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
    },
    auditLog: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0) },
  };
  const audit = { log: vi.fn().mockResolvedValue(undefined) };
  const totp = {
    generateSecret: vi.fn(() => 'TOTPSECRET'),
    keyuri: vi.fn(() => 'otpauth://totp/Delivery Platform Admin:u1?secret=TOTPSECRET'),
    verify: vi.fn(() => true),
  };
  return { prisma, audit, totp };
}

async function createService(mocks: ReturnType<typeof buildMocks>) {
  const moduleRef = await Test.createTestingModule({
    providers: [
      AdminService,
      { provide: PrismaService, useValue: mocks.prisma },
      { provide: AuditService, useValue: mocks.audit },
      { provide: TotpService, useValue: mocks.totp },
    ],
  }).compile();
  return moduleRef.get(AdminService);
}

describe('AdminService (unit)', () => {
  let mocks: ReturnType<typeof buildMocks>;
  let service: AdminService;

  beforeEach(async () => {
    mocks = buildMocks();
    service = await createService(mocks);
  });

  it('approves a pending account and audits the action', async () => {
    mocks.prisma.user.findUnique.mockResolvedValue({ id: 'u1', role: 'merchant', status: 'pending' });
    mocks.prisma.user.update.mockResolvedValue({ id: 'u1', status: 'active' });
    const res = await service.approve('u1', 'admin1', ctx);
    expect(res.status).toBe('active');
    expect(mocks.prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'u1' }, data: { status: 'active' } }),
    );
    expect(mocks.audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: 'admin1', action: 'admin.approve', entityId: 'u1' }),
    );
  });

  it('refuses to approve an account that is not pending', async () => {
    mocks.prisma.user.findUnique.mockResolvedValue({ id: 'u1', role: 'merchant', status: 'active' });
    await expect(service.approve('u1', 'admin1', ctx)).rejects.toBeInstanceOf(BadRequestException);
    expect(mocks.prisma.user.update).not.toHaveBeenCalled();
  });

  it('rejects (suspends) an account with a reason', async () => {
    mocks.prisma.user.findUnique.mockResolvedValue({ id: 'u1', role: 'courier', status: 'pending' });
    mocks.prisma.user.update.mockResolvedValue({ id: 'u1', status: 'suspended' });
    const res = await service.reject('u1', 'bad docs', 'admin1', ctx);
    expect(res.status).toBe('suspended');
    expect(mocks.audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'admin.reject', metadata: expect.objectContaining({ reason: 'bad docs' }) }),
    );
  });

  it('refuses to reactivate an account that is not suspended', async () => {
    mocks.prisma.user.findUnique.mockResolvedValue({ id: 'u1', role: 'courier', status: 'active' });
    await expect(service.reactivate('u1', 'admin1', ctx)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws NotFound for an unknown user', async () => {
    mocks.prisma.user.findUnique.mockResolvedValue(null);
    await expect(service.approve('missing', 'admin1', ctx)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('sets up 2FA by storing a pending secret and returning an otpauth URI', async () => {
    mocks.prisma.user.findUnique.mockResolvedValue({ id: 'u1', phone: '+213550123456', totpEnabled: false });
    mocks.prisma.user.update.mockResolvedValue({});
    const res = await service.setupTwoFactor('u1', ctx);
    expect(res.secret).toBe('TOTPSECRET');
    expect(res.otpauthUrl).toContain('otpauth://');
    expect(mocks.prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { totpPendingSecret: 'TOTPSECRET' } }),
    );
  });

  it('enables 2FA after verifying the code against the pending secret', async () => {
    mocks.prisma.user.findUnique.mockResolvedValue({ id: 'u1', totpPendingSecret: 'TOTPSECRET', totpEnabled: false });
    mocks.totp.verify.mockReturnValue(true);
    mocks.prisma.user.update.mockResolvedValue({});
    const res = await service.enableTwoFactor('u1', '123456', ctx);
    expect(res.enabled).toBe(true);
    expect(mocks.totp.verify).toHaveBeenCalledWith('123456', 'TOTPSECRET');
    expect(mocks.prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { totpSecret: 'TOTPSECRET', totpEnabled: true, totpPendingSecret: null } }),
    );
  });

  it('refuses to enable 2FA with an invalid code', async () => {
    mocks.prisma.user.findUnique.mockResolvedValue({ id: 'u1', totpPendingSecret: 'TOTPSECRET' });
    mocks.totp.verify.mockReturnValue(false);
    await expect(service.enableTwoFactor('u1', '000000', ctx)).rejects.toBeInstanceOf(BadRequestException);
    expect(mocks.prisma.user.update).not.toHaveBeenCalled();
  });

  it('refuses to enable 2FA before setup', async () => {
    mocks.prisma.user.findUnique.mockResolvedValue({ id: 'u1', totpPendingSecret: null });
    await expect(service.enableTwoFactor('u1', '123456', ctx)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('upserts a platform setting and audits it', async () => {
    mocks.prisma.adminSetting.upsert.mockResolvedValue({ key: 'platform.pricing', value: { commissionRate: 0.1 } });
    const res = await service.upsertSetting('platform.pricing', { commissionRate: 0.1 }, 'admin1', ctx);
    expect(res.key).toBe('platform.pricing');
    expect(mocks.audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'admin.setting.upsert', entityId: 'platform.pricing' }),
    );
  });

  it('rejects an invalid setting key', async () => {
    await expect(service.upsertSetting('Bad Key!', {}, 'admin1', ctx)).rejects.toBeInstanceOf(BadRequestException);
    expect(mocks.prisma.adminSetting.upsert).not.toHaveBeenCalled();
  });

  it('lists audit entries with filters', async () => {
    mocks.prisma.auditLog.findMany.mockResolvedValue([{ id: 'a1', action: 'admin.approve' }]);
    const res = await service.listAudit({ entity: 'user', limit: 10 });
    expect(res).toHaveLength(1);
    expect(mocks.prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ entity: 'user' }), take: 10 }),
    );
  });

  it('returns real aggregate stats', async () => {
    mocks.prisma.user.groupBy
      .mockResolvedValueOnce([{ role: 'customer', _count: { _all: 3 } }, { role: 'admin', _count: { _all: 1 } }])
      .mockResolvedValueOnce([{ status: 'active', _count: { _all: 4 } }]);
    mocks.prisma.user.count.mockResolvedValueOnce(2).mockResolvedValueOnce(5);
    mocks.prisma.auditLog.count.mockResolvedValue(10);
    const res = await service.stats();
    expect(res.users.total).toBe(4);
    expect(res.users.byRole.customer).toBe(3);
    expect(res.pendingApplications).toBe(2);
    expect(res.newUsersLast7Days).toBe(5);
    expect(res.auditEvents).toBe(10);
  });
});