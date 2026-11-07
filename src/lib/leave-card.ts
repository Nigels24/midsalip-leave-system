// The electronic leave card (/credits): ledger entries merged into one row per transaction,
// with running VL and SL balances. Same as the prototype's leave card, but with Prisma.Decimal
// so 1.25 + 1.25 is exactly 2.5. Pure function: no database (verify:engine scenario q tests it).
import { Prisma, type CreditKind } from "../generated/prisma/client";

/** One LedgerEntry row, with its @db.Date already turned into "YYYY-MM-DD". */
export interface LedgerInput {
  date: string;
  particulars: string;
  kind: CreditKind;
  earned: Prisma.Decimal;
  deducted: Prisma.Decimal;
}

export interface LeaveCardRow {
  date: string;
  particulars: string;
  vlEarned: Prisma.Decimal;
  vlDeducted: Prisma.Decimal;
  vlBalance: Prisma.Decimal;
  slEarned: Prisma.Decimal;
  slDeducted: Prisma.Decimal;
  slBalance: Prisma.Decimal;
}

/**
 * Entries with the same date and particulars (e.g. "Earned – November 2026" for VL and for SL)
 * become one row. Rows are in date order; each balance is everything up to and including that row.
 * The last row's balances therefore equal balance() in src/server/leave/credits.ts.
 */
export function leaveCardRows(entries: LedgerInput[]): LeaveCardRow[] {
  const zero = new Prisma.Decimal(0);
  const rows: LeaveCardRow[] = [];
  const byKey = new Map<string, LeaveCardRow>();

  // sort() keeps the original order for equal dates, so the caller's order (createdAt) is kept.
  for (const entry of [...entries].sort((a, b) => a.date.localeCompare(b.date))) {
    const key = `${entry.date}|${entry.particulars}`;
    let row = byKey.get(key);
    if (!row) {
      row = { date: entry.date, particulars: entry.particulars, vlEarned: zero, vlDeducted: zero, vlBalance: zero, slEarned: zero, slDeducted: zero, slBalance: zero };
      byKey.set(key, row);
      rows.push(row);
    }
    if (entry.kind === "VL") {
      row.vlEarned = row.vlEarned.plus(entry.earned);
      row.vlDeducted = row.vlDeducted.plus(entry.deducted);
    } else {
      row.slEarned = row.slEarned.plus(entry.earned);
      row.slDeducted = row.slDeducted.plus(entry.deducted);
    }
  }

  let vl = zero;
  let sl = zero;
  for (const row of rows) {
    vl = vl.plus(row.vlEarned).minus(row.vlDeducted);
    sl = sl.plus(row.slEarned).minus(row.slDeducted);
    row.vlBalance = vl;
    row.slBalance = sl;
  }
  return rows;
}
