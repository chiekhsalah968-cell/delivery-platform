import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';

type CheckStatus = 'up' | 'down';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Liveness + dependency readiness probe' })
  async check(): Promise<Record<string, unknown>> {
    const [db, redis] = await Promise.all([this.checkDb(), this.checkRedis()]);
    const body = {
      status: db === 'up' && redis === 'up' ? 'ok' : 'degraded',
      checks: { db, redis },
      uptime_s: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
    if (body.status !== 'ok') {
      throw new ServiceUnavailableException(body);
    }
    return body;
  }

  private async checkDb(): Promise<CheckStatus> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return 'up';
    } catch {
      return 'down';
    }
  }

  private async checkRedis(): Promise<CheckStatus> {
    try {
      const pong = await Promise.race([
        this.redis.ping(),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('ping timeout')), 2000)),
      ]);
      return pong === 'PONG' ? 'up' : 'down';
    } catch {
      return 'down';
    }
  }
}