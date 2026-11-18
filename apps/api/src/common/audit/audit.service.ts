import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@delivery/db';
import { PrismaService } from '../../prisma/prisma.service';

export interface AuditEntry {
  actorId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
}

/** Best-effort security audit trail. A failed write never blocks the user action. */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: entry.actorId ?? null,
          action: entry.action,
          entity: entry.entity,
          entityId: entry.entityId ?? null,
          ip: entry.ip ?? null,
          userAgent: entry.userAgent ?? null,
          metadata: (entry.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
        },
      });
    } catch (error) {
      this.logger.warn(`audit write failed for ${entry.action}: ${(error as Error).message}`);
    }
  }
}