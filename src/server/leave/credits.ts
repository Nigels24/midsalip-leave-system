// Leave credits (VL and SL), read from the leave card (LedgerEntry).
// All amounts are Prisma.Decimal: 1.25 + 1.25 must be exactly 2.5, which JS floats do not guarantee.
import { Prisma, type CreditKind } from "../../generated/prisma/client";
import { OPEN_STATUSES } from "../../lib/constants";
import { toDbDate } from "../../lib/dates";
import type { DbClient } from "./shared";

export const ZERO = new Prisma.Decimal(0);

/** Balance = everything earned minus everything deducted, optionally only up to a date ("YYYY-MM-DD"). */
export async function balance(client: DbClient, employeeId: string, kind: CreditKind, asOf?: string) {
  const sum = await client.ledgerEntry.aggregate({
    where: { employeeId, kind, date: asOf ? { lte: toDbDate(asOf) } : undefined },
    _sum: { earned: true, deducted: true },
  });
  return (sum._sum.earned ?? ZERO).minus(sum._sum.deducted ?? ZERO);
}

/**
 * Days already asked for in applications that are still open and deduct from this kind.
 * They are not on the leave card yet (only approval deducts), but they must be reserved
 * so an employee cannot file more than their balance across several applications.
 */
export async function pendingDays(client: DbClient, employeeId: string, kind: CreditKind, excludeApplicationId?: string) {
  const sum = await client.leaveApplication.aggregate({
    where: {
      employeeId,
      status: { in: OPEN_STATUSES },
      leaveType: { deductsFrom: kind },
      id: excludeApplicationId ? { not: excludeApplicationId } : undefined,
    },
    _sum: { days: true },
  });
  return sum._sum.days ?? ZERO;
}

/** Balance, pending and available (balance minus pending) for VL and SL, same as the prototype. */
export async function credits(client: DbClient, employeeId: string) {
  const vl = await balance(client, employeeId, "VL");
  const sl = await balance(client, employeeId, "SL");
  const vlPending = await pendingDays(client, employeeId, "VL");
  const slPending = await pendingDays(client, employeeId, "SL");
  return { vl, sl, vlPending, slPending, vlAvailable: vl.minus(vlPending), slAvailable: sl.minus(slPending) };
}

export type Credits = Awaited<ReturnType<typeof credits>>;

/** The available credits of one kind. */
export const availableOf = (c: Credits, kind: CreditKind) => (kind === "VL" ? c.vlAvailable : c.slAvailable);

/** "vacation" / "sick", for messages. */
export const creditWord = (kind: CreditKind) => (kind === "VL" ? "vacation" : "sick");
