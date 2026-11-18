import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  CourierAvailabilityInput,
  CourierLocationInput,
  CourierProfileInput,
  CustomerProfileInput,
  MerchantProfileInput,
} from '@delivery/shared';
import { AuditService } from '../../common/audit/audit.service';
import type { AuthenticatedUser, RequestContext } from '../../common/types';
import { PrismaService } from '../../prisma/prisma.service';

const geoInclude = {
  wilaya: { select: { code: true, nameAr: true, nameFr: true } },
  municipality: { select: { id: true, nameAr: true, nameFr: true } },
} as const;

@Injectable()
export class ProfilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getMyProfile(user: AuthenticatedUser) {
    const [customerProfile, merchantProfile, courierProfile, addresses] = await Promise.all([
      user.role === 'customer'
        ? this.prisma.customerProfile.findUnique({ where: { userId: user.id } })
        : null,
      user.role === 'merchant'
        ? this.prisma.merchantProfile.findUnique({ where: { userId: user.id }, include: geoInclude })
        : null,
      user.role === 'courier'
        ? this.prisma.courierProfile.findUnique({ where: { userId: user.id }, include: geoInclude })
        : null,
      this.prisma.address.findMany({
        where: { userId: user.id },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
        include: geoInclude,
      }),
    ]);

    const vehicles =
      user.role === 'courier' && courierProfile
        ? await this.prisma.vehicle.findMany({
            where: { courierProfileId: courierProfile.id },
            orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
          })
        : [];

    return { role: user.role, customerProfile, merchantProfile, courierProfile, vehicles, addresses };
  }

  async upsertCustomerProfile(userId: string, input: CustomerProfileInput, ctx: RequestContext) {
    const profile = await this.prisma.customerProfile.upsert({
      where: { userId },
      create: { userId, fullName: input.fullName },
      update: { fullName: input.fullName },
    });
    await this.audit.log({ actorId: userId, action: 'profile.customer.upsert', entity: 'customer_profile', entityId: profile.id, ...ctx });
    return profile;
  }

  async upsertMerchantProfile(userId: string, input: MerchantProfileInput, ctx: RequestContext) {
    await this.assertMunicipality(input.wilayaCode, input.municipalityId);
    const data = {
      businessName: input.businessName,
      description: input.description ?? null,
      wilayaCode: input.wilayaCode,
      municipalityId: input.municipalityId ?? null,
      addressLine: input.addressLine,
      ...(input.latitude !== undefined ? { latitude: input.latitude, longitude: input.longitude } : {}),
    };
    const profile = await this.prisma.merchantProfile.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
      include: geoInclude,
    });
    await this.audit.log({ actorId: userId, action: 'profile.merchant.upsert', entity: 'merchant_profile', entityId: profile.id, ...ctx });
    return profile;
  }

  async upsertCourierProfile(userId: string, input: CourierProfileInput, ctx: RequestContext) {
    await this.assertMunicipality(input.wilayaCode, input.municipalityId);
    const data = {
      fullName: input.fullName,
      wilayaCode: input.wilayaCode,
      municipalityId: input.municipalityId ?? null,
      ...(input.latitude !== undefined ? { latitude: input.latitude, longitude: input.longitude } : {}),
    };
    const profile = await this.prisma.courierProfile.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
      include: geoInclude,
    });
    await this.audit.log({ actorId: userId, action: 'profile.courier.upsert', entity: 'courier_profile', entityId: profile.id, ...ctx });
    return profile;
  }

  async setAvailability(userId: string, input: CourierAvailabilityInput, ctx: RequestContext) {
    const profile = await this.prisma.courierProfile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException('Complete your courier profile first');
    const updated = await this.prisma.courierProfile.update({
      where: { userId },
      data: { availability: input.availability },
      include: geoInclude,
    });
    await this.audit.log({ actorId: userId, action: 'courier.availability', entity: 'courier_profile', entityId: profile.id, ...ctx, metadata: { availability: input.availability } });
    return updated;
  }

  async setLocation(userId: string, input: CourierLocationInput, ctx: RequestContext) {
    const profile = await this.prisma.courierProfile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException('Complete your courier profile first');
    const updated = await this.prisma.courierProfile.update({
      where: { userId },
      data: { latitude: input.latitude, longitude: input.longitude, locationUpdatedAt: new Date() },
      include: geoInclude,
    });
    await this.audit.log({ actorId: userId, action: 'courier.location', entity: 'courier_profile', entityId: profile.id, ...ctx });
    return updated;
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