import { prisma } from "@/lib/prisma";

export async function auditLog(
  action: string,
  entityType: string,
  entityId?: string | null,
  actorId?: string | null,
  metadata?: unknown
) {
  return prisma.auditLog.create({
    data: {
      action,
      entityType,
      entityId: entityId || undefined,
      actorId: actorId || undefined,
      metadata: metadata ? JSON.stringify(metadata) : undefined,
    },
  });
}
