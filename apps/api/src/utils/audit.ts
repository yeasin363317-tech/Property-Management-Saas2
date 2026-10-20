import type { Prisma } from '@prisma/client';
import { prisma, type Tx } from '../db';

export interface AuditInput {
  ownerId?: string | null;
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  metadata?: Prisma.InputJsonValue;
}

export async function audit(input: AuditInput, tx: Tx = prisma) {
  await tx.auditLog.create({
    data: {
      ownerId: input.ownerId ?? null,
      userId: input.userId ?? null,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId ?? null,
      metadata: input.metadata,
    },
  });
}
