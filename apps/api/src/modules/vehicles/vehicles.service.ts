import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@delivery/db';
import type { VehicleInput } from '@delivery/shared';
import { AuditService } from '../../common/audit/audit.service';
import type { RequestContext } from '../../common/types';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class VehiclesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(userId: string) {
    const profile = await this.requireProfile(userId);
    return this.prisma.vehicle.findMany({
      where: { courierProfileId: profile.id },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async create(userId: string, input: VehicleInput, ctx: RequestContext) {
    const profile = await this.requireProfile(userId);
    const existing = await this.prisma.vehicle.count({ where: { courierProfileId: profile.id } });
    const isDefault = input.isDefault ?? existing === 0;
    try {
      const vehicle = await this.prisma.$transaction(async (tx) => {
        if (isDefault) {
          await tx.vehicle.updateMany({
            where: { courierProfileId: profile.id, isDefault: true },
            data: { isDefault: false },
          });
        }
        return tx.vehicle.create({
          data: {
            courierProfileId: profile.id,
            type: input.type,
            plateNumber: input.plateNumber,
            brand: input.brand ?? null,
            model: input.model ?? null,
            color: input.color ?? null,
            isDefault,
          },
        });
      });
      await this.audit.log({ actorId: userId, action: 'vehicle.create', entity: 'vehicle', entityId: vehicle.id, ...ctx, metadata: { type: vehicle.type } });
      return vehicle;
    } catch (error) {
      throw this.mapPlateConflict(error);
    }
  }

  async update(userId: string, id: string, input: VehicleInput, ctx: RequestContext) {
    const vehicle = await this.requireOwned(userId, id);
    const isDefault = input.isDefault ?? vehicle.isDefault;
    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        if (isDefault) {
          await tx.vehicle.updateMany({
            where: { courierProfileId: vehicle.courierProfileId, isDefault: true, id: { not: id } },
            data: { isDefault: false },
          });
        }
        return tx.vehicle.update({
          where: { id },
          data: {
            type: input.type,
            plateNumber: input.plateNumber,
            brand: input.brand ?? null,
            model: input.model ?? null,
            color: input.color ?? null,
            isDefault,
          },
        });
      });
      await this.audit.log({ actorId: userId, action: 'vehicle.update', entity: 'vehicle', entityId: id, ...ctx });
      return updated;
    } catch (error) {
      throw this.mapPlateConflict(error);
    }
  }

  async remove(userId: string, id: string, ctx: RequestContext) {
    const vehicle = await this.requireOwned(userId, id);
    await this.prisma.$transaction(async (tx) => {
      await tx.vehicle.delete({ where: { id } });
      if (vehicle.isDefault) {
        const next = await tx.vehicle.findFirst({
          where: { courierProfileId: vehicle.courierProfileId },
          orderBy: { createdAt: 'asc' },
        });
        if (next) await tx.vehicle.update({ where: { id: next.id }, data: { isDefault: true } });
      }
    });
    await this.audit.log({ actorId: userId, action: 'vehicle.delete', entity: 'vehicle', entityId: id, ...ctx });
    return { success: true };
  }

  private async requireProfile(userId: string) {
    const profile = await this.prisma.courierProfile.findUnique({ where: { userId } });
    if (!profile) throw new BadRequestException('Complete your courier profile before adding vehicles');
    return profile;
  }

  private async requireOwned(userId: string, id: string) {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id },
      include: { courierProfile: { select: { userId: true } } },
    });
    if (!vehicle || vehicle.courierProfile.userId !== userId) {
      throw new NotFoundException('Vehicle not found');
    }
    return vehicle;
  }

  private mapPlateConflict(error: unknown): unknown {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return new ConflictException('A vehicle with this plate number already exists');
    }
    return error;
  }
}