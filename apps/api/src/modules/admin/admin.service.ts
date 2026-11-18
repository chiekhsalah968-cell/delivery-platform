import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@delivery/db';
import { settingKeySchema, type AuditQuery, type Role, type UserStatus } from '@delivery/shared';
import { AuditService } from '../../common/audit/audit.service';
import { TotpService } from '../../common/totp/totp.service';
import type { RequestContext } from '../../common/types';
import { PrismaService } from '../../prisma/prisma.service';

const profileInclude = {
  customerProfile: true,
  merchantProfile: { include: { wilaya: { select: { code: true, nameAr: true, nameFr: true } } } },
  courierProfile: {
    include: {
      wilaya: { select: { code: true, nameAr: true, nameFr: true } },
      vehicles: true,
    },
  },
} as const;

const publicUser = {
  id: true,
  phone: true,
  email: true,
  role: true,
  status: true,
  locale: true,
  createdAt: true,
} as const;

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly totp: TotpService,
  ) {}

  listUsers(filter: { status?: UserStatus; role?: Role }) {
    return this.prisma.user.findMany({
      where: { ...(filter.status ? { status: filter.status } : {}), ...(filter.role ? { role: filter.role } : {}) },
      orderBy: { createdAt: 'desc' },
      select: { ...publicUser, ...profileInclude },
      take: 200,
    });
  }

  listPending() {
    return this.prisma.user.findMany({
      where: { status: 'pending', role: { in: ['merchant', 'courier'] } },
      orderBy: { createdAt: 'asc' },
      select: { ...publicUser, ...profileInclude },
    });
  }

  async approve(userId: string, actorId: string, ctx: RequestContext) {
    const user = await this.requireUser(userId);
    if (user.status !== 'pending') throw new BadRequestException('Only pending accounts can be approved');
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { status: 'active' },
      select: publicUser,
    });
    await this.audit.log({ actorId, action: 'admin.approve', entity: 'user', entityId: userId, ...ctx, metadata: { role: user.role } });
    return updated;
  }

  async reject(userId: string, reason: string | undefined, actorId: string, ctx: RequestContext) {
    const user = await this.requireUser(userId);
    if (user.status === 'suspended') throw new BadRequestException('Account is already suspended');
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { status: 'suspended' },
      select: publicUser,
    });
    await this.audit.log({ actorId, action: 'admin.reject', entity: 'user', entityId: userId, ...ctx, metadata: { role: user.role, reason: reason ?? null } });
    return updated;
  }

  async reactivate(userId: string, actorId: string, ctx: RequestContext) {
    const user = await this.requireUser(userId);
    if (user.status !== 'suspended') throw new BadRequestException('Only suspended accounts can be reactivated');
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { status: 'active' },
      select: publicUser,
    });
    await this.audit.log({ actorId, action: 'admin.reactivate', entity: 'user', entityId: userId, ...ctx });
    return updated;
  }

  private async requireUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  // --- Two-factor authentication (admin self-service enrollment) -------------

  async twoFactorStatus(userId: string) {
    const user = await this.requireUser(userId);
    return { enabled: user.totpEnabled };
  }

  async setupTwoFactor(userId: string, ctx: RequestContext) {
    const user = await this.requireUser(userId);
    const secret = this.totp.generateSecret();
    await this.prisma.user.update({ where: { id: userId }, data: { totpPendingSecret: secret } });
    await this.audit.log({ actorId: userId, action: 'admin.2fa.setup', entity: 'user', entityId: userId, ...ctx });
    return { secret, otpauthUrl: this.totp.keyuri(user.phone, secret) };
  }

  async enableTwoFactor(userId: string, code: string, ctx: RequestContext) {
    const user = await this.requireUser(userId);
    if (!user.totpPendingSecret) throw new BadRequestException('Start 2FA setup first');
    if (!this.totp.verify(code, user.totpPendingSecret)) throw new BadRequestException('Invalid authenticator code');
    await this.prisma.user.update({
      where: { id: userId },
      data: { totpSecret: user.totpPendingSecret, totpEnabled: true, totpPendingSecret: null },
    });
    await this.audit.log({ actorId: userId, action: 'admin.2fa.enable', entity: 'user', entityId: userId, ...ctx });
    return { enabled: true };
  }

  async disableTwoFactor(userId: string, code: string, ctx: RequestContext) {
    const user = await this.requireUser(userId);
    if (!user.totpEnabled || !user.totpSecret) throw new BadRequestException('2FA is not enabled');
    if (!this.totp.verify(code, user.totpSecret)) throw new BadRequestException('Invalid authenticator code');
    await this.prisma.user.update({
      where: { id: userId },
      data: { totpEnabled: false, totpSecret: null, totpPendingSecret: null },
    });
    await this.audit.log({ actorId: userId, action: 'admin.2fa.disable', entity: 'user', entityId: userId, ...ctx });
    return { enabled: false };
  }

  // --- Platform settings -----------------------------------------------------

  private assertSettingKey(key: string): void {
    if (!settingKeySchema.safeParse(key).success) throw new BadRequestException('Invalid setting key');
  }

  listSettings() {
    return this.prisma.adminSetting.findMany({ orderBy: { key: 'asc' } });
  }

  async getSetting(key: string) {
    this.assertSettingKey(key);
    const setting = await this.prisma.adminSetting.findUnique({ where: { key } });
    if (!setting) throw new NotFoundException('Setting not found');
    return setting;
  }

  async upsertSetting(key: string, value: Record<string, unknown>, actorId: string, ctx: RequestContext) {
    this.assertSettingKey(key);
    const setting = await this.prisma.adminSetting.upsert({
      where: { key },
      create: { key, value: value as Prisma.InputJsonValue, updatedBy: actorId },
      update: { value: value as Prisma.InputJsonValue, updatedBy: actorId },
    });
    await this.audit.log({ actorId, action: 'admin.setting.upsert', entity: 'admin_setting', entityId: key, ...ctx, metadata: { key } });
    return setting;
  }

  async deleteSetting(key: string, actorId: string, ctx: RequestContext) {
    this.assertSettingKey(key);
    const existing = await this.prisma.adminSetting.findUnique({ where: { key } });
    if (!existing) throw new NotFoundException('Setting not found');
    await this.prisma.adminSetting.delete({ where: { key } });
    await this.audit.log({ actorId, action: 'admin.setting.delete', entity: 'admin_setting', entityId: key, ...ctx, metadata: { key } });
    return { success: true };
  }

  // --- Activity monitoring & stats -------------------------------------------

  listAudit(query: AuditQuery) {
    return this.prisma.auditLog.findMany({
      where: {
        ...(query.entity ? { entity: query.entity } : {}),
        ...(query.action ? { action: query.action } : {}),
        ...(query.actorId ? { actorId: query.actorId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: query.limit,
      include: { actor: { select: { id: true, phone: true, role: true } } },
    });
  }

  async stats() {
    const [byRole, byStatus, pending, newUsers, auditEvents] = await Promise.all([
      this.prisma.user.groupBy({ by: ['role'], _count: { _all: true } }),
      this.prisma.user.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.user.count({ where: { status: 'pending', role: { in: ['merchant', 'courier'] } } }),
      this.prisma.user.count({ where: { createdAt: { gte: new Date(Date.now() - 7 * 86400000) } } }),
      this.prisma.auditLog.count(),
    ]);
    const roleCounts = Object.fromEntries(byRole.map((r) => [r.role, r._count._all]));
    const statusCounts = Object.fromEntries(byStatus.map((s) => [s.status, s._count._all]));
    return {
      users: {
        total: byRole.reduce((sum, r) => sum + r._count._all, 0),
        byRole: roleCounts,
        byStatus: statusCounts,
      },
      pendingApplications: pending,
      newUsersLast7Days: newUsers,
      auditEvents,
    };
  }
}