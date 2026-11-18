import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { AddressInput } from '@delivery/shared';
import { AuditService } from '../../common/audit/audit.service';
import type { RequestContext } from '../../common/types';
import { PrismaService } from '../../prisma/prisma.service';

const geoInclude = {
  wilaya: { select: { code: true, nameAr: true, nameFr: true } },
  municipality: { select: { id: true, nameAr: true, nameFr: true } },
} as const;

@Injectable()
export class AddressesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  list(userId: string) {
    return this.prisma.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      include: geoInclude,
    });
  }

  async create(userId: string, input: AddressInput, ctx: RequestContext) {
    await this.assertMunicipality(input.wilayaCode, input.municipalityId);
    const existing = await this.prisma.address.count({ where: { userId } });
    const isDefault = input.isDefault ?? existing === 0;
    const address = await this.prisma.$transaction(async (tx) => {
      if (isDefault) {
        await tx.address.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } });
      }
      return tx.address.create({
        data: {
          userId,
          label: input.label,
          wilayaCode: input.wilayaCode,
          municipalityId: input.municipalityId ?? null,
          addressLine: input.addressLine,
          latitude: input.latitude ?? null,
          longitude: input.longitude ?? null,
          isDefault,
        },
        include: geoInclude,
      });
    });
    await this.audit.log({ actorId: userId, action: 'address.create', entity: 'address', entityId: address.id, ...ctx });
    return address;
  }

  async update(userId: string, id: string, input: AddressInput, ctx: RequestContext) {
    await this.requireOwned(userId, id);
    await this.assertMunicipality(input.wilayaCode, input.municipalityId);
    const isDefault = input.isDefault ?? false;
    const address = await this.prisma.$transaction(async (tx) => {
      if (isDefault) {
        await tx.address.updateMany({ where: { userId, isDefault: true, id: { not: id } }, data: { isDefault: false } });
      }
      return tx.address.update({
        where: { id },
        data: {
          label: input.label,
          wilayaCode: input.wilayaCode,
          municipalityId: input.municipalityId ?? null,
          addressLine: input.addressLine,
          latitude: input.latitude ?? null,
          longitude: input.longitude ?? null,
          isDefault,
        },
        include: geoInclude,
      });
    });
    await this.audit.log({ actorId: userId, action: 'address.update', entity: 'address', entityId: id, ...ctx });
    return address;
  }

  async remove(userId: string, id: string, ctx: RequestContext) {
    const address = await this.requireOwned(userId, id);
    await this.prisma.$transaction(async (tx) => {
      await tx.address.delete({ where: { id } });
      if (address.isDefault) {
        const next = await tx.address.findFirst({ where: { userId }, orderBy: { createdAt: 'asc' } });
        if (next) await tx.address.update({ where: { id: next.id }, data: { isDefault: true } });
      }
    });
    await this.audit.log({ actorId: userId, action: 'address.delete', entity: 'address', entityId: id, ...ctx });
    return { success: true };
  }

  private async requireOwned(userId: string, id: string) {
    const address = await this.prisma.address.findUnique({ where: { id } });
    if (!address || address.userId !== userId) throw new NotFoundException('Address not found');
    return address;
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