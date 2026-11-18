import { HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';
import { RedisService } from '../../redis/redis.service';
import { RateLimitGuard } from './rate-limit.guard';

function context() {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ ip: '127.0.0.1', method: 'POST', path: '/api/auth/login' }),
    }),
  } as never;
}

function build(reflectorValue: unknown, client: Record<string, unknown>) {
  const reflector = { getAllAndOverride: vi.fn().mockReturnValue(reflectorValue) } as unknown as Reflector;
  const redis = { client } as unknown as RedisService;
  return new RateLimitGuard(reflector, redis);
}

describe('RateLimitGuard', () => {
  it('passes through when no limit is configured', async () => {
    const incr = vi.fn();
    const guard = build(undefined, { incr });
    await expect(guard.canActivate(context())).resolves.toBe(true);
    expect(incr).not.toHaveBeenCalled();
  });

  it('allows requests under the limit and sets expiry on the first hit', async () => {
    const client = { incr: vi.fn().mockResolvedValue(1), expire: vi.fn().mockResolvedValue(1) };
    const guard = build({ limit: 10, ttlSeconds: 60 }, client);
    await expect(guard.canActivate(context())).resolves.toBe(true);
    expect(client.expire).toHaveBeenCalledWith(expect.any(String), 60);
  });

  it('throws 429 when the limit is exceeded', async () => {
    const client = {
      incr: vi.fn().mockResolvedValue(11),
      expire: vi.fn(),
      ttl: vi.fn().mockResolvedValue(42),
    };
    const guard = build({ limit: 10, ttlSeconds: 60 }, client);
    await expect(guard.canActivate(context())).rejects.toMatchObject({
      status: HttpStatus.TOO_MANY_REQUESTS,
    });
  });

  it('fails open when Redis is unavailable', async () => {
    const client = { incr: vi.fn().mockRejectedValue(new Error('redis down')) };
    const guard = build({ limit: 10, ttlSeconds: 60 }, client);
    await expect(guard.canActivate(context())).resolves.toBe(true);
  });

  it('HttpException from the limiter is rethrown (not swallowed)', async () => {
    const client = {
      incr: vi.fn().mockResolvedValue(99),
      expire: vi.fn(),
      ttl: vi.fn().mockResolvedValue(5),
    };
    const guard = build({ limit: 10, ttlSeconds: 60 }, client);
    await expect(guard.canActivate(context())).rejects.toBeInstanceOf(HttpException);
  });
});