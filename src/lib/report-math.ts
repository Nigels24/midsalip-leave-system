// Small pure helpers for the Reports page (tested by verify:engine scenario s).
import { Prisma } from "../generated/prisma/client";

/** Adds Decimal amounts exactly (never JS floats). */
export const sumDecimals = (values: Prisma.Decimal[]) => values.reduce((sum, v) => sum.plus(v), new Prisma.Decimal(0));

/**
 * Approved days per month of the year, by the month the leave STARTS in
 * (the same "year of the start date" rule as the rest of the system).
 * Always returns 12 months, January first, so empty months show as 0.
 */
export function monthlyTotals(apps: { startDate: string; days: Prisma.Decimal }[], year: number) {
  const months = Array.from({ length: 12 }, (_, i) => ({
    month: `${year}-${String(i + 1).padStart(2, "0")}`,
    count: 0,
    days: new Prisma.Decimal(0),
  }));
  for (const a of apps) {
    const m = months.find((x) => x.month === a.startDate.slice(0, 7));
    if (!m) continue; // another year
    m.count += 1;
    m.days = m.days.plus(a.days);
  }
  return months;
}

/**
 * Audit details are plain text written by the system, but as a safety net anything that looks like
 * a password hash (bcrypt "$2b$10$...") or an image data URL (an e-signature) is hidden before display.
 */
export function safeAuditDetail(detail: string) {
  return detail
    .replace(/\$2[abxy]\$\d{2}\$[./A-Za-z0-9]{53}/g, "[hidden]")
    .replace(/data:[a-z]+\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]+/gi, "[image]");
}
