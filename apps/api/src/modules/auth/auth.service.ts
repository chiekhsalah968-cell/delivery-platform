import {
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma, type User } from '@delivery/db';
import {
  normalizeDzPhone,
  type AdminLoginInput,
  type AdminMfaVerifyInput,
  type AuthTokens,
  type AuthUser,
  type LoginInput,
  type RegisterInput,
} from '@delivery/shared';
import { randomUUID } from 'node:crypto';
import { AuditService } from '../../common/audit/audit.service';
import { TokenService } from '../../common/token/token.service';
import { TotpService } from '../../common/totp/totp.service';
import type { RequestContext } from '../../common/types';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { getDummyHash, hashPassword, verifyPassword } from './password';

export interface AuthResult extends AuthTokens {
  user: AuthUser;
}

export type AdminLoginResult =
  | { mfaRequired: true; mfaToken: string }
  | ({ mfaRequired: false; user: AuthUser } & AuthTokens);

const ADMIN_MAX_FAILURES = 5;
const ADMIN_LOCKOUT_TTL_S = 900;

function toAuthUser(user: User): AuthUser {
  return {
    id: user.id,
    phone: user.phone,
    email: user.email,
    role: user.role,
    status: user.status,
    locale: user.locale,
    createdAt: user.createdAt.toISOString(),
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly audit: AuditService,
    private readonly redis: RedisService,
    private readonly totp: TotpService,
  ) {}

  async register(input: RegisterInput, ctx: RequestContext): Promise<AuthResult> {
    const phone = normalizeDzPhone(input.phone);
    if (!phone) throw new ConflictException('Invalid Algerian phone number');

    const email = input.email?.toLowerCase() ?? null;
    const passwordHash = await hashPassword(input.password);
    // Customers are active immediately; merchants/couriers await admin approval (M2).
    const status = input.role === 'customer' ? 'active' : 'pending';

    let user: User;
    try {
      user = await this.prisma.user.create({
        data: {
          phone,
          email,
          passwordHash,
          role: input.role,
          status,
          locale: input.locale ?? 'ar',
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const target = (error.meta?.target as string[] | undefined)?.join(',') ?? '';
        throw new ConflictException(
          target.includes('email') ? 'Email already registered' : 'Phone already registered',
        );
      }
      throw error;
    }

    await this.audit.log({
      actorId: user.id,
      action: 'auth.register',
      entity: 'user',
      entityId: user.id,
      ...ctx,
      metadata: { role: user.role, status: user.status },
    });

    return { user: toAuthUser(user), ...(await this.issueTokens(user)) };
  }

  async login(input: LoginInput, ctx: RequestContext): Promise<AuthResult> {
    const identifier = input.identifier.trim();
    const isEmail = identifier.includes('@');
    const phone = isEmail ? null : normalizeDzPhone(identifier);
    const user = await this.prisma.user.findUnique({
      where: isEmail ? { email: identifier.toLowerCase() } : { phone: phone ?? identifier },
    });

    // Verify against a dummy hash when the account is missing to reduce timing enumeration.
    const passwordHash = user?.passwordHash ?? (await getDummyHash());
    let passwordOk = false;
    try {
      passwordOk = await verifyPassword(passwordHash, input.password);
    } catch {
      passwordOk = false;
    }

    if (!user || !passwordOk) {
      await this.audit.log({
        action: 'auth.login.failed',
        entity: 'user',
        ...ctx,
        metadata: { identifierType: isEmail ? 'email' : 'phone' },
      });
      throw new UnauthorizedException('Invalid credentials');
    }
    // Admins must authenticate through the dedicated admin flow, never the public login.
    if (user.role === 'admin') {
      await this.audit.log({
        actorId: user.id,
        action: 'auth.login.admin_denied',
        entity: 'user',
        entityId: user.id,
        ...ctx,
      });
      throw new ForbiddenException('Admin accounts must sign in through the admin app');
    }
    if (user.status === 'suspended') throw new ForbiddenException('Account suspended');

    await this.audit.log({
      actorId: user.id,
      action: 'auth.login.success',
      entity: 'user',
      entityId: user.id,
      ...ctx,
    });

    return { user: toAuthUser(user), ...(await this.issueTokens(user)) };
  }

  async refresh(rawToken: string, ctx: RequestContext): Promise<AuthTokens> {
    let payload;
    try {
      payload = await this.tokens.verifyRefresh(rawToken);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (payload.type !== 'refresh' || !payload.jti || !payload.familyId || !payload.sub) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.tokens.hashToken(rawToken) },
    });
    if (!stored || stored.userId !== payload.sub) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (stored.revokedAt) {
      // Reuse of a rotated token: revoke the entire family (possible theft).
      await this.prisma.refreshToken.updateMany({
        where: { familyId: stored.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await this.audit.log({
        actorId: stored.userId,
        action: 'auth.refresh.reuse_detected',
        entity: 'refresh_token',
        entityId: stored.id,
        ...ctx,
        metadata: { familyId: stored.familyId },
      });
      throw new UnauthorizedException('Refresh token reuse detected');
    }

    if (stored.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    const user = await this.prisma.user.findUnique({ where: { id: stored.userId } });
    if (!user) throw new UnauthorizedException('User no longer exists');
    if (user.status === 'suspended') throw new ForbiddenException('Account suspended');

    // Preserve the session's authentication strength (e.g. admin TOTP) across rotation.
    const amr = payload.amr ?? ['pwd'];
    const tokenId = randomUUID();
    const refreshToken = await this.tokens.signRefresh({
      userId: user.id,
      familyId: stored.familyId,
      tokenId,
      amr,
    });
    const accessToken = await this.tokens.signAccess(user, amr);

    // Rotate atomically: revoke the presented token and persist its successor.
    await this.prisma.$transaction([
      this.prisma.refreshToken.update({
        where: { id: stored.id },
        data: { revokedAt: new Date() },
      }),
      this.prisma.refreshToken.create({
        data: {
          id: tokenId,
          userId: user.id,
          tokenHash: this.tokens.hashToken(refreshToken),
          familyId: stored.familyId,
          expiresAt: new Date(Date.now() + this.tokens.refreshTtl * 1000),
        },
      }),
    ]);

    await this.audit.log({
      actorId: user.id,
      action: 'auth.refresh',
      entity: 'refresh_token',
      entityId: tokenId,
      ...ctx,
    });

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: this.tokens.accessTtl,
    };
  }

  async logout(rawToken: string, ctx: RequestContext): Promise<{ success: boolean }> {
    try {
      await this.tokens.verifyRefresh(rawToken);
      const stored = await this.prisma.refreshToken.findUnique({
        where: { tokenHash: this.tokens.hashToken(rawToken) },
      });
      if (stored) {
        await this.prisma.refreshToken.updateMany({
          where: { familyId: stored.familyId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        await this.audit.log({
          actorId: stored.userId,
          action: 'auth.logout',
          entity: 'refresh_token',
          entityId: stored.id,
          ...ctx,
        });
      }
    } catch {
      // An invalid/expired token has nothing to revoke; logout is idempotent.
    }
    return { success: true };
  }

  async me(userId: string): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    return toAuthUser(user);
  }

  private async issueTokens(user: User, amr: string[] = ['pwd']): Promise<AuthTokens> {
    const familyId = randomUUID();
    const tokenId = randomUUID();
    const refreshToken = await this.tokens.signRefresh({ userId: user.id, familyId, tokenId, amr });
    const accessToken = await this.tokens.signAccess(user, amr);
    await this.prisma.refreshToken.create({
      data: {
        id: tokenId,
        userId: user.id,
        tokenHash: this.tokens.hashToken(refreshToken),
        familyId,
        expiresAt: new Date(Date.now() + this.tokens.refreshTtl * 1000),
      },
    });
    return { accessToken, refreshToken, tokenType: 'Bearer', expiresIn: this.tokens.accessTtl };
  }

  /** Dedicated admin login. Returns a TOTP challenge when 2FA is enabled, else tokens. */
  async adminLogin(input: AdminLoginInput, ctx: RequestContext): Promise<AdminLoginResult> {
    const identifier = input.identifier.trim();
    const isEmail = identifier.includes('@');
    const phone = isEmail ? null : normalizeDzPhone(identifier);
    const user = await this.prisma.user.findUnique({
      where: isEmail ? { email: identifier.toLowerCase() } : { phone: phone ?? identifier },
    });

    if (user) await this.assertNotLocked(user.id);

    const passwordHash = user?.passwordHash ?? (await getDummyHash());
    let passwordOk = false;
    try {
      passwordOk = await verifyPassword(passwordHash, input.password);
    } catch {
      passwordOk = false;
    }

    if (!user || !passwordOk) {
      if (user) await this.recordFailure(user.id);
      await this.audit.log({
        action: 'auth.admin.login.failed',
        entity: 'user',
        entityId: user?.id ?? null,
        ...ctx,
        metadata: { identifierType: isEmail ? 'email' : 'phone' },
      });
      throw new UnauthorizedException('Invalid credentials');
    }
    if (user.role !== 'admin') {
      await this.audit.log({ actorId: user.id, action: 'auth.admin.login.denied_role', entity: 'user', entityId: user.id, ...ctx });
      throw new ForbiddenException('Admin access only');
    }
    if (user.status === 'suspended') throw new ForbiddenException('Account suspended');

    await this.clearFailures(user.id);

    if (user.totpEnabled) {
      const mfaToken = await this.tokens.signMfaChallenge(user.id);
      await this.audit.log({ actorId: user.id, action: 'auth.admin.login.mfa_challenge', entity: 'user', entityId: user.id, ...ctx });
      return { mfaRequired: true, mfaToken };
    }

    await this.audit.log({ actorId: user.id, action: 'auth.admin.login.success', entity: 'user', entityId: user.id, ...ctx, metadata: { amr: ['pwd'] } });
    return { mfaRequired: false, user: toAuthUser(user), ...(await this.issueTokens(user, ['pwd'])) };
  }

  /** Step 2 of admin login: verify the TOTP code against the challenge token. */
  async adminVerifyMfa(input: AdminMfaVerifyInput, ctx: RequestContext): Promise<AuthResult & { mfaRequired: false }> {
    let payload;
    try {
      payload = await this.tokens.verifyMfaChallenge(input.mfaToken);
    } catch {
      throw new UnauthorizedException('Invalid or expired 2FA challenge');
    }
    if (payload.type !== 'mfa' || payload.scope !== 'admin_login' || !payload.sub) {
      throw new UnauthorizedException('Invalid 2FA challenge');
    }
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.role !== 'admin') throw new UnauthorizedException('Invalid 2FA challenge');
    if (user.status === 'suspended') throw new ForbiddenException('Account suspended');

    await this.assertNotLocked(user.id);
    if (!user.totpEnabled || !user.totpSecret) {
      throw new UnauthorizedException('2FA is not enabled for this account');
    }
    if (!this.totp.verify(input.code, user.totpSecret)) {
      await this.recordFailure(user.id);
      await this.audit.log({ actorId: user.id, action: 'auth.admin.2fa.failed', entity: 'user', entityId: user.id, ...ctx });
      throw new UnauthorizedException('Invalid authenticator code');
    }

    await this.clearFailures(user.id);
    await this.audit.log({ actorId: user.id, action: 'auth.admin.login.success', entity: 'user', entityId: user.id, ...ctx, metadata: { amr: ['pwd', 'totp'] } });
    return { mfaRequired: false, user: toAuthUser(user), ...(await this.issueTokens(user, ['pwd', 'totp'])) };
  }

  private lockoutKey(userId: string): string {
    return `admin:fail:${userId}`;
  }

  private async assertNotLocked(userId: string): Promise<void> {
    try {
      const count = await this.redis.client.get(this.lockoutKey(userId));
      if (count && Number(count) >= ADMIN_MAX_FAILURES) {
        const ttl = await this.redis.client.ttl(this.lockoutKey(userId));
        throw new HttpException(
          { message: 'Too many failed attempts. Try again later.', retryAfter: ttl > 0 ? ttl : ADMIN_LOCKOUT_TTL_S },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    } catch (error) {
      if (error instanceof HttpException) throw error;
      // Fail open if Redis is unavailable so an outage cannot lock admins out.
    }
  }

  private async recordFailure(userId: string): Promise<void> {
    try {
      const key = this.lockoutKey(userId);
      const count = await this.redis.client.incr(key);
      if (count === 1) await this.redis.client.expire(key, ADMIN_LOCKOUT_TTL_S);
    } catch {
      // Fail open; the IP rate limiter still applies.
    }
  }

  private async clearFailures(userId: string): Promise<void> {
    try {
      await this.redis.client.del(this.lockoutKey(userId));
    } catch {
      // Ignore; the counter expires on its own.
    }
  }
}