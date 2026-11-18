import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@delivery/db';
import { AuditService } from '../../common/audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { VehiclesService } from './vehicles.service';

const ctx = { ip: '127.0.0.1', userAgent: 'vitest' };
const input = { type: 'motorcycle' as const, plateNumber: '111111-116-16' };

function buildMocks() {
  const prisma: Record<string, any> = {
    courierProfile: { findUnique: vi.fn() },
    vehicle: {
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      delete: vi.fn().mockResolvedValue({}),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
  };
  // Callback-form transactions receive the prisma mock as the tx client.
  prisma.$transaction = vi.fn(async (arg: any) => (Array.isArray(arg) ? Promise.all(arg) : arg(prisma)));
  const audit = { log: vi.fn().mockResolvedValue(undefined) };
  return { prisma, audit };
}

async function createService(mocks: ReturnType<typeof buildMocks>) {
  const moduleRef = await Test.createTestingModule({
    providers: [
      VehiclesService,
      { provide: PrismaService, useValue: mocks.prisma },
      { provide: AuditService, useValue: mocks.audit },
    ],
  }).compile();
  return moduleRef.get(VehiclesService);
}

describe('VehiclesService (unit)', () => {
  let mocks: ReturnType<typeof buildMocks>;
  let service: VehiclesService;

  beforeEach(async () => {
    mocks = buildMocks();
    service = await createService(mocks);
  });

  it('makes the first vehicle the default', async () => {
    mocks.prisma.courierProfile.findUnique.mockResolvedValue({ id: 'cp1' });
    mocks.prisma.vehicle.count.mockResolvedValue(0);
    mocks.prisma.vehicle.create.mockResolvedValue({ id: 'v1', isDefault: true });
    const res = await service.create('u1', input, ctx);
    expect(res.isDefault).toBe(true);
    expect(mocks.prisma.vehicle.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ isDefault: true, courierProfileId: 'cp1' }) }),
    );
  });

  it('requires a courier profile before adding a vehicle', async () => {
    mocks.prisma.courierProfile.findUnique.mockResolvedValue(null);
    await expect(service.create('u1', input, ctx)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('maps a duplicate plate to a conflict', async () => {
    mocks.prisma.courierProfile.findUnique.mockResolvedValue({ id: 'cp1' });
    mocks.prisma.vehicle.count.mockResolvedValue(1);
    mocks.prisma.vehicle.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'test' }),
    );
    await expect(service.create('u1', input, ctx)).rejects.toBeInstanceOf(ConflictException);
  });

  it('promotes the next vehicle when the default is removed', async () => {
    mocks.prisma.vehicle.findUnique.mockResolvedValue({
      id: 'v1',
      courierProfileId: 'cp1',
      isDefault: true,
      courierProfile: { userId: 'u1' },
    });
    mocks.prisma.vehicle.findFirst.mockResolvedValue({ id: 'v2' });
    const res = await service.remove('u1', 'v1', ctx);
    expect(res.success).toBe(true);
    expect(mocks.prisma.vehicle.delete).toHaveBeenCalledWith({ where: { id: 'v1' } });
    expect(mocks.prisma.vehicle.update).toHaveBeenCalledWith({ where: { id: 'v2' }, data: { isDefault: true } });
  });

  it('rejects removal of a vehicle owned by another courier', async () => {
    mocks.prisma.vehicle.findUnique.mockResolvedValue({
      id: 'v1',
      courierProfileId: 'cp1',
      isDefault: false,
      courierProfile: { userId: 'someone-else' },
    });
    await expect(service.remove('u1', 'v1', ctx)).rejects.toBeInstanceOf(NotFoundException);
    expect(mocks.prisma.vehicle.delete).not.toHaveBeenCalled();
  });
});