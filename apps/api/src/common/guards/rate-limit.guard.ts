import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { RedisService } from '../../redis/redis.service';
import { RATE_LIMIT_KEY, type RateLimitOptions } from '../decorators/rate-limit.decorator';

/**
 * Fixed-window rate limiter backed by Redis. Applied only where @RateLimit is set
 * (auth endpoints). Fails open if Redis is unavailable so an outage cannot lock
 * every user out; the failure is logged.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly redis: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options = this.reflector.getAllAndOverride<RateLimitOptions>(RATE_LIMIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!options) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const ip = request.ip ?? 'unknown';
    const key = `rl:${request.method}:${request.path}:${ip}`;

    try {
      const count = await this.redis.client.incr(key);
      if (count === 1) await this.redis.client.expire(key, options.ttlSeconds);
      if (count > options.limit) {
        const ttl = await this.redis.client.ttl(key);
        throw new HttpException(
          { message: 'Too many requests', retryAfter: ttl > 0 ? ttl : options.ttlSeconds },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.warn(`rate limit check failed (failing open): ${(error as Error).message}`);
    }
    return true;
  }
}