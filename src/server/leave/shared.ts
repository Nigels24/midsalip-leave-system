// Small helpers used by every file in src/server/leave.
import type { Prisma, PrismaClient } from "../../generated/prisma/client";

/**
 * Every leave function takes the database client as its first argument.
 * It can be the normal client (`db` from src/lib/db.ts) or a transaction client (`tx`),
 * so the same code also runs inside a bigger transaction (e.g. prisma/verify-engine.ts).
 */
export type DbClient = PrismaClient | Prisma.TransactionClient;

/**
 * Runs fn inside a transaction, so all writes of one action are saved together or not at all.
 * If client is already a transaction, Prisma 7 opens a nested one (a PostgreSQL SAVEPOINT):
 * a refused action is undone on its own and the outer transaction carries on.
 */
export function inTransaction<T>(client: DbClient, fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return client.$transaction(fn);
}

/** Sends the same notification to each user. */
export async function notify(tx: DbClient, userIds: string[], title: string, body: string, applicationId?: string) {
  if (userIds.length === 0) return;
  await tx.notification.createMany({
    data: userIds.map((userId) => ({ userId, title, body, applicationId })),
  });
}

/** Writes one Audit Trail row. actorId is null only for actions without a signed-in user (server console). */
export async function audit(tx: DbClient, actorId: string | null, action: string, detail: string) {
  await tx.auditLog.create({ data: { actorId, action, detail } });
}
