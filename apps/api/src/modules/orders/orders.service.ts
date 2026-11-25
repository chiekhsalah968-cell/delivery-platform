import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import {
  canTransition,
  normalizeDzPhone,
  type OrderCancelInput,
  type OrderCreateInput,
  type OrderQuery,
  type OrderStatus,
} from '@delivery/shared';
import { Prisma } from '@delivery/db';
import { AuditService } from '../../common/audit/audit.service';
import type { AuthenticatedUser, RequestContext } from '../../common/types';
import { PrismaService } from '../../prisma/prisma.service';

/** Relations returned with every order. Deliberately excludes the merchant's user id. */
const orderInclude = {
  items: { orderBy: { name: 'asc' } },
  statusEvents: {
    orderBy: { createdAt: 'asc' },
    include: { actor: { select: { id: true, role: true } } },
  },
  pickupWilaya: { select: { code: true, nameAr: true, nameFr: true } },
  pickupMunicipality: { select: { id: true, nameAr: true, nameFr: true } },
  dropoffWilaya: { select: { code: true, nameAr: true, nameFr: true } },
  dropoffMunicipality: { select: { id: true, nameAr: true, nameFr: true } },
  merchantProfile: { select: { id: true, businessName: true } },
} as const;

/** Minimal projection used only to decide whether an actor may see an order. */
const ownershipSelect = {
  id: true,
  status: true,
  customerUserId: true,
  merchantProfile: { select: { userId: true } },
} as const;

type Ownership = Prisma.OrderGetPayload<{ select: typeof ownershipSelect }>;

function generateOrderNumber(): string {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return `ORD-${ymd}-${randomBytes(3).toString('hex').toUpperCase()}`;
}

function isOrderNumberConflict(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') return false;
  const target = error.meta?.target;
  if (Array.isArray(target)) return target.includes('orderNumber');
  return true;
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(user: AuthenticatedUser, input: OrderCreateInput, ctx: RequestContext) {
    const merchant = await this.prisma.merchantProfile.findUnique({
      where: { userId: user.id },
      include: { wilaya: true },
    });
    if (!merchant) throw new BadRequestException('Complete your merchant profile before creating orders');

    await this.assertMunicipality(input.dropoffWilayaCode, input.dropoffMunicipalityId);

    const phone = normalizeDzPhone(input.customerPhone);
    if (!phone) throw new BadRequestException('Invalid customer phone number');

    // Link the order to an existing customer account when the phone matches one.
    const customer = await this.prisma.user.findFirst({
      where: { phone, role: 'customer' },
      select: { id: true },
    });

    const items = input.items.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice ?? null,
    }));
    const subtotal = items.reduce((sum, item) => sum + item.quantity * (item.unitPrice ?? 0), 0);
    const deliveryFee = input.deliveryFee ?? 0;

    const order = await this.createWithUniqueNumber({
      merchantId: merchant.id,
      customerUserId: customer?.id ?? null,
      customerPhone: phone,
      merchant,
      input,
      items,
      subtotal,
      deliveryFee,
      total: subtotal + deliveryFee,
      actorId: user.id,
    });

    await this.audit.log({
      actorId: user.id,
      action: 'order.create',
      entity: 'order',
      entityId: order.id,
      ...ctx,
      metadata: { orderNumber: order.orderNumber, total: order.total },
    });
    return order;
  }

  async list(user: AuthenticatedUser, query: OrderQuery) {
    const where = await this.scopeWhere(user);
    if (!where) return { items: [], total: 0, page: query.page, pageSize: query.pageSize };

    if (query.status) where.status = query.status;

    const [total, items] = await this.prisma.$transaction([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: orderInclude,
      }),
    ]);
    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  async getById(user: AuthenticatedUser, id: string) {
    await this.requireAccess(user, id);
    const order = await this.prisma.order.findUnique({ where: { id }, include: orderInclude });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async cancel(user: AuthenticatedUser, id: string, input: OrderCancelInput, ctx: RequestContext) {
    const ownership = await this.requireAccess(user, id);
    const target: OrderStatus = 'cancelled';
    if (!canTransition(ownership.status, target)) {
      throw new ConflictException(`An order in status "${ownership.status}" can no longer be cancelled`);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      // Conditional update guarantees a single winner if two cancellations race.
      const res = await tx.order.updateMany({
        where: { id, status: ownership.status },
        data: {
          status: target,
          cancelledAt: new Date(),
          cancelledById: user.id,
          cancelReason: input.reason ?? null,
        },
      });
      if (res.count === 0) throw new ConflictException('Order status changed; please refresh and retry');
      await tx.orderStatusEvent.create({
        data: {
          orderId: id,
          fromStatus: ownership.status,
          toStatus: target,
          actorId: user.id,
          note: input.reason ?? null,
        },
      });
      return tx.order.findUniqueOrThrow({ where: { id }, include: orderInclude });
    });

    await this.audit.log({
      actorId: user.id,
      action: 'order.cancel',
      entity: 'order',
      entityId: id,
      ...ctx,
      metadata: { reason: input.reason ?? null },
    });
    return updated;
  }

  private async createWithUniqueNumber(args: {
    merchantId: string;
    customerUserId: string | null;
    customerPhone: string;
    merchant: { businessName: string; addressLine: string; latitude: number | null; longitude: number | null; wilayaCode: number; municipalityId: string | null };
    input: OrderCreateInput;
    items: { name: string; quantity: number; unitPrice: number | null }[];
    subtotal: number;
    deliveryFee: number;
    total: number;
    actorId: string;
  }) {
    const { merchant, input } = args;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        return await this.prisma.$transaction((tx) =>
          tx.order.create({
            data: {
              orderNumber: generateOrderNumber(),
              merchantProfileId: args.merchantId,
              customerUserId: args.customerUserId,
              status: 'pending_dispatch',
              paymentMethod: 'cod',
              pickupBusinessName: merchant.businessName,
              pickupWilayaCode: merchant.wilayaCode,
              pickupMunicipalityId: merchant.municipalityId,
              pickupAddressLine: merchant.addressLine,
              pickupLatitude: merchant.latitude,
              pickupLongitude: merchant.longitude,
              customerName: input.customerName,
              customerPhone: args.customerPhone,
              dropoffWilayaCode: input.dropoffWilayaCode,
              dropoffMunicipalityId: input.dropoffMunicipalityId ?? null,
              dropoffAddressLine: input.dropoffAddressLine,
              dropoffLatitude: input.dropoffLatitude ?? null,
              dropoffLongitude: input.dropoffLongitude ?? null,
              notes: input.notes ?? null,
              subtotal: args.subtotal,
              deliveryFee: args.deliveryFee,
              total: args.total,
              items: { create: args.items },
              statusEvents: {
                create: { fromStatus: null, toStatus: 'pending_dispatch', actorId: args.actorId, note: 'Order created' },
              },
            },
            include: orderInclude,
          }),
        );
      } catch (error) {
        if (isOrderNumberConflict(error)) continue;
        throw error;
      }
    }
    throw new ConflictException('Could not allocate an order number, please retry');
  }

  /** Returns the scoping filter for a role, or null when the actor has no orders. */
  private async scopeWhere(user: AuthenticatedUser): Promise<Prisma.OrderWhereInput | null> {
    if (user.role === 'admin') return {};
    if (user.role === 'customer') return { customerUserId: user.id };
    if (user.role === 'merchant') {
      const profile = await this.prisma.merchantProfile.findUnique({
        where: { userId: user.id },
        select: { id: true },
      });
      return profile ? { merchantProfileId: profile.id } : null;
    }
    // Couriers see assigned orders only, which arrives with the dispatch engine (M4).
    return null;
  }

  private async requireAccess(user: AuthenticatedUser, id: string): Promise<Ownership> {
    const order = await this.prisma.order.findUnique({ where: { id }, select: ownershipSelect });
    if (!order) throw new NotFoundException('Order not found');
    const allowed =
      user.role === 'admin' ||
      (user.role === 'merchant' && order.merchantProfile.userId === user.id) ||
      (user.role === 'customer' && order.customerUserId === user.id);
    if (!allowed) throw new NotFoundException('Order not found');
    return order;
  }

  private async assertMunicipality(wilayaCode: number, municipalityId?: string): Promise<void> {
    const wilaya = await this.prisma.wilaya.findUnique({ where: { code: wilayaCode } });
    if (!wilaya) throw new BadRequestException('Unknown wilaya code');
    if (!municipalityId) return;
    const municipality = await this.prisma.municipality.findUnique({ where: { id: municipalityId } });
    if (!municipality || municipality.wilayaCode !== wilayaCode) {
      throw new BadRequestException('Municipality does not belong to the selected wilaya');
    }
  }
}
