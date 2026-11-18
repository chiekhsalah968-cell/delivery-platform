import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  adminLoginSchema,
  adminMfaVerifySchema,
  loginSchema,
  refreshSchema,
  registerSchema,
  type AdminLoginInput,
  type AdminMfaVerifyInput,
  type AuthTokens,
  type LoginInput,
  type RefreshInput,
  type RegisterInput,
} from '@delivery/shared';
import type { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { requestContext, type AuthenticatedUser } from '../../common/types';
import { AuthService, type AdminLoginResult, type AuthResult } from './auth.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @RateLimit({ limit: 5, ttlSeconds: 60 })
  @Post('register')
  @ApiOperation({ summary: 'Register a customer, merchant, or courier account' })
  register(
    @Body(new ZodValidationPipe(registerSchema)) body: RegisterInput,
    @Req() req: Request,
  ): Promise<AuthResult> {
    return this.auth.register(body, requestContext(req));
  }

  @Public()
  @RateLimit({ limit: 10, ttlSeconds: 60 })
  @Post('login')
  @ApiOperation({ summary: 'Log in with phone or email + password' })
  login(
    @Body(new ZodValidationPipe(loginSchema)) body: LoginInput,
    @Req() req: Request,
  ): Promise<AuthResult> {
    return this.auth.login(body, requestContext(req));
  }

  @Public()
  @RateLimit({ limit: 5, ttlSeconds: 300 })
  @Post('admin/login')
  @ApiOperation({ summary: 'Admin login step 1: password (returns a 2FA challenge when enabled)' })
  adminLogin(
    @Body(new ZodValidationPipe(adminLoginSchema)) body: AdminLoginInput,
    @Req() req: Request,
  ): Promise<AdminLoginResult> {
    return this.auth.adminLogin(body, requestContext(req));
  }

  @Public()
  @RateLimit({ limit: 10, ttlSeconds: 300 })
  @Post('admin/2fa/verify')
  @ApiOperation({ summary: 'Admin login step 2: verify the TOTP code' })
  adminVerifyMfa(
    @Body(new ZodValidationPipe(adminMfaVerifySchema)) body: AdminMfaVerifyInput,
    @Req() req: Request,
  ): Promise<AuthResult & { mfaRequired: false }> {
    return this.auth.adminVerifyMfa(body, requestContext(req));
  }

  @Public()
  @RateLimit({ limit: 30, ttlSeconds: 60 })
  @Post('refresh')
  @ApiOperation({ summary: 'Rotate a refresh token and obtain a new access token' })
  refresh(
    @Body(new ZodValidationPipe(refreshSchema)) body: RefreshInput,
    @Req() req: Request,
  ): Promise<AuthTokens> {
    return this.auth.refresh(body.refreshToken, requestContext(req));
  }

  @Public()
  @Post('logout')
  @ApiOperation({ summary: 'Revoke the refresh token family' })
  logout(
    @Body(new ZodValidationPipe(refreshSchema)) body: RefreshInput,
    @Req() req: Request,
  ): Promise<{ success: boolean }> {
    return this.auth.logout(body.refreshToken, requestContext(req));
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Return the authenticated user profile' })
  me(@CurrentUser() user: AuthenticatedUser): Promise<AuthResult['user']> {
    return this.auth.me(user.id);
  }
}