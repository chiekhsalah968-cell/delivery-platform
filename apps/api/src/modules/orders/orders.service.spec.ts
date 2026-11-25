import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuditService } from '../../common/audit/audit.service';
import type { AuthenticatedUser } from '../../common/types';
import { PrismaService } from '../../prisma/prisma.service';
import { OrdersService } from './orders.service';

const ctx = { ip: '127.0.0.1', userAgent: 'vitest' };

const orderInput = {
  customerName: 'Ahmed Benali',
  customerPhone: '0550123456',
  dropoffWilayaCode: 16,
  dropoffAddressLine: '12 Rue Didouche Mourad',
  items: [{ name: 'Phone case', quantity: 2, unitPrice: 1500 }],
  deliveryFee: 300,
};

function user(role: AuthenticatedUser['role'], id: string): AuthenticatedUser {
  return { id, phone: '+213550000000', email: null, role, status: 'active', locale: 'ar', amr: ['pwd'], totpEnabled: false };
}

const merchant = user('merchant', 'u1');
const customer = user('customer', 'cust1');

function buildMocks() {
  const prisma: Record<string, any> = {
    merchantProfile: { findUnique: vi.fn() },
    user: { findFirst: vi.fn() },
    wilaya: { findUnique: vi.fn() },
    municipality: { findUnique: vi.fn() },
    order: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      updateMany: vi.fn(),
    },
    orderStatusEvent: { create: vi.fn() },
  };
  prisma.$transaction = vi.fn(async (arg: any) => (Array.isArray(arg) ? Promise.all(arg) : arg(prisma)));
  const audit = { log: vi.fn().mockResolvedValue(undefined) };
  return { prisma, audit };
}

async function createService(mocks: ReturnType<typeof buildMocks>) {
  const moduleRef = await Test.createTestingModule({
    providers: [
      OrdersService,
      { provide: PrismaService, useValue: mocks.prisma },
      { provide: AuditService, useValue: mocks.audit },
    ],
  }).compile();
  return moduleRef.get(OrdersService);
}

describe('OrdersService (unit)', () => {
  let mocks: ReturnType<typeof buildMocks>;
  let service: OrdersService;

  beforeEach(async () => {
    mocks = buildMocks();
    service = await createService(mocks);
  });

  it('requires a merchant profile before creating an order', async () => {
    mocks.prisma.merchantProfile.findUnique.mockResolvedValue(null);
    await expect(service.create(merchant, orderInput, ctx)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('computes totals, normalizes the phone, links the customer and records the first status event', async () => {
    mocks.prisma.merchantProfile.findUnique.mockResolvedValue({
      id: 'mp1',
      businessName: 'Shop',
      addressLine: '1 Main St',
      latitude: 36.75,
      longitude: 3.06,
      wilayaCode: 16,
      municipalityId: null,
      wilaya: { code: 16 },
    });
    mocks.prisma.wilaya.findUnique.mockResolvedValue({ code: 16 });
    mocks.prisma.user.findFirst.mockResolvedValue({ id: 'cust1' });
    mocks.prisma.order.create.mockResolvedValue({ id: 'o1', orderNumber: 'ORD-X', total: 3300 });

    const res = await service.create(merchant, orderInput, ctx);
    expect(res.id).toBe('o1');

    const data = mocks.prisma.order.create.mock.calls[0]![0].data;
    expect(data).toEqual(
      expect.objectContaining({
        merchantProfileId: 'mp1',
        customerUserId: 'cust1',
        customerPhone: '+213550123456',
        status: 'pending_dispatch',
        paymentMethod: 'cod',
        subtotal: 3000,
        deliveryFee: 300,
        total: 3300,
        pickupBusinessName: 'Shop',
      }),
    );
    expect(data.statusEvents.create).toEqual(
      expect.objectContaining({ toStatus: 'pending_dispatch', actorId: 'u1' }),
    );
    expect(mocks.audit.log).toHaveBeenCalled();
  });

  it('scopes a customer list to their own orders', async () => {
    mocks.prisma.order.count.mockResolvedValue(1);
    mocks.prisma.order.findMany.mockResolvedValue([{ id: 'o1' }]);

    const res = await service.list(customer, { page: 1, pageSize: 20 });
    expect(res.total).toBe(1);
    expect(mocks.prisma.order.count).toHaveBeenCalledWith({ where: { customerUserId: 'cust1' } });
    expect(mocks.prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { customerUserId: 'cust1' }, take: 20, skip: 0 }),
    );
  });

  it('returns an empty list for a merchant without a profile', async () => {
    mocks.prisma.merchantProfile.findUnique.mockResolvedValue(null);
    const res = await service.list(merchant, { page: 1, pageSize: 20 });
    expect(res).toEqual({ items: [], total: 0, page: 1, pageSize: 20 });
    expect(mocks.prisma.order.findMany).not.toHaveBeenCalled();
  });

  it('refuses to cancel an order that is already picked up', async () => {
    mocks.prisma.order.findUnique.mockResolvedValue({
      id: 'o1',
      status: 'picked_up',
      customerUserId: 'cust1',
      merchantProfile: { userId: 'u1' },
    });
    await expect(service.cancel(merchant, 'o1', {}, ctx)).rejects.toBeInstanceOf(ConflictException);
    expect(mocks.prisma.order.updateMany).not.toHaveBeenCalled();
  });

  it('cancels a pending order and records the transition', async () => {
    mocks.prisma.order.findUnique.mockResolvedValue({
      id: 'o1',
      status: 'pending_dispatch',
      customerUserId: 'cust1',
      merchantProfile: { userId: 'u1' },
    });
    mocks.prisma.order.updateMany.mockResolvedValue({ count: 1 });
    mocks.prisma.orderStatusEvent.create.mockResolvedValue({});
    mocks.prisma.order.findUniqueOrThrow.mockResolvedValue({ id: 'o1', status: 'cancelled' });

    const res = await service.cancel(merchant, 'o1', { reason: 'changed mind' }, ctx);
    expect(res.status).toBe('cancelled');
    expect(mocks.prisma.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'o1', status: 'pending_dispatch' } }),
    );
    expect(mocks.prisma.orderStatusEvent.create).toHaveBeenCalled();
    expect(mocks.audit.log).toHaveBeenCalled();
  });

  it('detects a concurrent change and aborts the cancel', async () => {
    mocks.prisma.order.findUnique.mockResolvedValue({
      id: 'o1',
      status: 'pending_dispatch',
      customerUserId: 'cust1',
      merchantProfile: { userId: 'u1' },
    });
    mocks.prisma.order.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.cancel(merchant, 'o1', {}, ctx)).rejects.toBeInstanceOf(ConflictException);
    expect(mocks.prisma.order.findUniqueOrThrow).not.toHaveBeenCalled();
  });

  it('hides orders that do not belong to the caller', async () => {
    mocks.prisma.order.findUnique.mockResolvedValue({
      id: 'o1',
      status: 'pending_dispatch',
      customerUserId: 'someone-else',
      merchantProfile: { userId: 'u9' },
    });
    await expect(service.getById(customer, 'o1')).rejects.toBeInstanceOf(NotFoundException);
  });
});
