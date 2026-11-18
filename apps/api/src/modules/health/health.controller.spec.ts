import { ServiceUnavailableException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { HealthController } from './health.controller';

async function createController(dbUp: boolean, redisUp: boolean): Promise<HealthController> {
  const moduleRef = await Test.createTestingModule({
    controllers: [HealthController],
    providers: [
      {
        provide: PrismaService,
        useValue: {
          $queryRaw: dbUp ? vi.fn().mockResolvedValue([{ ok: 1 }]) : vi.fn().mockRejectedValue(new Error('db down')),
        },
      },
      {
        provide: RedisService,
        useValue: {
          ping: redisUp ? vi.fn().mockResolvedValue('PONG') : vi.fn().mockRejectedValue(new Error('redis down')),
        },
      },
    ],
  }).compile();
  return moduleRef.get(HealthController);
}

describe('HealthController', () => {
  it('reports ok when all dependencies are up', async () => {
    const controller = await createController(true, true);
    const body = await controller.check();
    expect(body.status).toBe('ok');
    expect(body.checks).toEqual({ db: 'up', redis: 'up' });
  });

  it('returns 503 when the database is down', async () => {
    const controller = await createController(false, true);
    await expect(controller.check()).rejects.toThrow(ServiceUnavailableException);
  });

  it('returns 503 when redis is down', async () => {
    const controller = await createController(true, false);
    await expect(controller.check()).rejects.toThrow(ServiceUnavailableException);
  });
});