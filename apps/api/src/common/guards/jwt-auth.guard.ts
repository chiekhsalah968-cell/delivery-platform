import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { TokenService } from '../token/token.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import type { AuthenticatedUser } from '../types';

function extractBearer(header?: string): string | null {
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token.trim();
}

/**
 * Secure-by-default authentication. Every route requires a valid access token
 * unless explicitly marked @Public(). Loads the user to enforce account status.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const token = extractBearer(request.headers.authorization);
    if (!token) throw new UnauthorizedException('Missing bearer token');

    let payload;
    try {
      payload = await this.tokens.verifyAccess(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
    if (payload.type !== 'access' || !payload.sub) {
      throw new UnauthorizedException('Invalid token');
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) throw new UnauthorizedException('User no longer exists');
    if (user.status === 'suspended') throw new ForbiddenException('Account suspended');

    const principal: AuthenticatedUser = {
      id: user.id,
      phone: user.phone,
      email: user.email,
      role: user.role,
      status: user.status,
      locale: user.locale,
      amr: payload.amr ?? [],
      totpEnabled: user.totpEnabled,
    };
    (request as Request & { user: AuthenticatedUser }).user = principal;
    return true;
  }
}