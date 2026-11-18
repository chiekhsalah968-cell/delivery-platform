import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import {
  adminDecisionSchema,
  adminSettingUpsertSchema,
  auditQuerySchema,
  ROLES,
  totpCodeSchema,
  USER_STATUSES,
  type AdminDecisionInput,
  type AdminSettingUpsertInput,
  type AuditQuery,
  type TotpCodeInput,
} from '@delivery/shared';
import type { Request } from 'express';
import type { AdminSetting, Prisma } from '@delivery/db';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { requestContext, type AuthenticatedUser } from '../../common/types';
import { AdminService } from './admin.service';

const userQuerySchema = z.object({
  status: z.enum(USER_STATUSES).optional(),
  role: z.enum(ROLES).optional(),
});
type UserQuery = z.infer<typeof userQuerySchema>;

type AuditLogWithActor = Prisma.AuditLogGetPayload<{
  include: { actor: { select: { id: true; phone: true; role: true } } };
}>;

@ApiTags('admin')
@ApiBearerAuth()
@Roles('admin')
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('users')
  @ApiOperation({ summary: 'List users, optionally filtered by status and role' })
  listUsers(@Query(new ZodValidationPipe(userQuerySchema)) query: UserQuery) {
    return this.admin.listUsers(query);
  }

  @Get('pending')
  @ApiOperation({ summary: 'List pending merchant and courier applications' })
  listPending() {
    return this.admin.listPending();
  }

  @Post('users/:id/approve')
  @ApiOperation({ summary: 'Approve a pending account' })
  approve(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.admin.approve(id, actor.id, requestContext(req));
  }

  @Post('users/:id/reject')
  @ApiOperation({ summary: 'Reject (suspend) an account' })
  reject(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(adminDecisionSchema)) body: AdminDecisionInput,
    @Req() req: Request,
  ) {
    return this.admin.reject(id, body.reason, actor.id, requestContext(req));
  }

  @Post('users/:id/reactivate')
  @ApiOperation({ summary: 'Reactivate a suspended account' })
  reactivate(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.admin.reactivate(id, actor.id, requestContext(req));
  }

  // --- Two-factor authentication ---------------------------------------------

  @Get('2fa/status')
  @ApiOperation({ summary: 'Whether the current admin has 2FA enabled' })
  twoFactorStatus(@CurrentUser() actor: AuthenticatedUser) {
    return this.admin.twoFactorStatus(actor.id);
  }

  @Post('2fa/setup')
  @ApiOperation({ summary: 'Begin TOTP enrollment: returns a secret and otpauth URI' })
  setupTwoFactor(@CurrentUser() actor: AuthenticatedUser, @Req() req: Request) {
    return this.admin.setupTwoFactor(actor.id, requestContext(req));
  }

  @Post('2fa/enable')
  @ApiOperation({ summary: 'Confirm a TOTP code to enable 2FA' })
  enableTwoFactor(
    @CurrentUser() actor: AuthenticatedUser,
    @Body(new ZodValidationPipe(totpCodeSchema)) body: TotpCodeInput,
    @Req() req: Request,
  ) {
    return this.admin.enableTwoFactor(actor.id, body.code, requestContext(req));
  }

  @Post('2fa/disable')
  @ApiOperation({ summary: 'Disable 2FA (requires a valid TOTP code)' })
  disableTwoFactor(
    @CurrentUser() actor: AuthenticatedUser,
    @Body(new ZodValidationPipe(totpCodeSchema)) body: TotpCodeInput,
    @Req() req: Request,
  ) {
    return this.admin.disableTwoFactor(actor.id, body.code, requestContext(req));
  }

  // --- Platform settings -----------------------------------------------------

  @Get('settings')
  @ApiOperation({ summary: 'List platform settings' })
  listSettings(): Promise<AdminSetting[]> {
    return this.admin.listSettings();
  }

  @Get('settings/:key')
  @ApiOperation({ summary: 'Get a platform setting by key' })
  getSetting(@Param('key') key: string): Promise<AdminSetting> {
    return this.admin.getSetting(key);
  }

  @Put('settings/:key')
  @ApiOperation({ summary: 'Create or update a platform setting' })
  upsertSetting(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('key') key: string,
    @Body(new ZodValidationPipe(adminSettingUpsertSchema)) body: AdminSettingUpsertInput,
    @Req() req: Request,
  ): Promise<AdminSetting> {
    return this.admin.upsertSetting(key, body.value, actor.id, requestContext(req));
  }

  @Delete('settings/:key')
  @ApiOperation({ summary: 'Delete a platform setting' })
  deleteSetting(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('key') key: string,
    @Req() req: Request,
  ) {
    return this.admin.deleteSetting(key, actor.id, requestContext(req));
  }

  // --- Activity & stats ------------------------------------------------------

  @Get('audit')
  @ApiOperation({ summary: 'Browse the security audit trail' })
  listAudit(@Query(new ZodValidationPipe(auditQuerySchema)) query: AuditQuery): Promise<AuditLogWithActor[]> {
    return this.admin.listAudit(query);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Platform statistics (real aggregates)' })
  stats() {
    return this.admin.stats();
  }
}