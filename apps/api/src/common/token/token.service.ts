import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash } from 'node:crypto';
import type { Role } from '@delivery/shared';

export interface AccessPayload {
  sub: string;
  role: Role;
  type: 'access';
  amr?: string[];
  iat: number;
  exp: number;
}

export interface RefreshPayload {
  sub: string;
  familyId: string;
  jti: string;
  type: 'refresh';
  amr?: string[];
  iat: number;
  exp: number;
}

/** Short-lived challenge issued after the admin password step, before TOTP verification. */
export interface MfaPayload {
  sub: string;
  type: 'mfa';
  scope: 'admin_login';
  iat: number;
  exp: number;
}

export const MFA_CHALLENGE_TTL_S = 300;

/** Signs/verifies access + refresh JWTs and hashes refresh tokens for storage. */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  get accessTtl(): number {
    return this.config.getOrThrow<number>('ACCESS_TOKEN_TTL_S');
  }

  get refreshTtl(): number {
    return this.config.getOrThrow<number>('REFRESH_TOKEN_TTL_S');
  }

  private get accessSecret(): string {
    return this.config.getOrThrow<string>('JWT_ACCESS_SECRET');
  }

  private get refreshSecret(): string {
    return this.config.getOrThrow<string>('JWT_REFRESH_SECRET');
  }

  signAccess(user: { id: string; role: Role }, amr: string[] = ['pwd']): Promise<string> {
    return this.jwt.signAsync(
      { sub: user.id, role: user.role, type: 'access', amr },
      { secret: this.accessSecret, expiresIn: this.accessTtl },
    );
  }

  signMfaChallenge(userId: string): Promise<string> {
    return this.jwt.signAsync(
      { sub: userId, type: 'mfa', scope: 'admin_login' },
      { secret: this.accessSecret, expiresIn: MFA_CHALLENGE_TTL_S },
    );
  }

  verifyMfaChallenge(token: string): Promise<MfaPayload> {
    return this.jwt.verifyAsync<MfaPayload>(token, { secret: this.accessSecret });
  }

  signRefresh(params: { userId: string; familyId: string; tokenId: string; amr?: string[] }): Promise<string> {
    return this.jwt.signAsync(
      { sub: params.userId, familyId: params.familyId, jti: params.tokenId, type: 'refresh', amr: params.amr ?? ['pwd'] },
      { secret: this.refreshSecret, expiresIn: this.refreshTtl },
    );
  }

  verifyAccess(token: string): Promise<AccessPayload> {
    return this.jwt.verifyAsync<AccessPayload>(token, { secret: this.accessSecret });
  }

  verifyRefresh(token: string): Promise<RefreshPayload> {
    return this.jwt.verifyAsync<RefreshPayload>(token, { secret: this.refreshSecret });
  }

  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}