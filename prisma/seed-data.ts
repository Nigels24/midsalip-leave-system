// Reference data shared by BOTH seeds:
//   prisma/seed.ts             demo data for development (npm run db:seed)
//   prisma/seed-production.ts  what a real install needs to run (npm run db:seed:production)
import type { PrismaClient } from "../src/generated/prisma/client";
import { toDbDate } from "../src/lib/dates";
import { LEAVE_TYPES } from "../src/lib/leave-types";

/** The offices of the municipal hall: [code, name]. */
export const OFFICES: [id: string, name: string][] = [
  ["MO", "Office of the Municipal Mayor"],
  ["HRMO", "Human Resource Management Office"],
  ["MTO", "Office of the Municipal Treasurer"],
  ["MACCO", "Office of the Municipal Accountant"],
  ["MEO", "Office of the Municipal Engineer"],
  ["MSWDO", "Municipal Social Welfare and Development Office"],
  ["MHO", "Municipal Health Office"],
];

/**
 * Philippine non-working holidays of 2026, the starting list of a new install.
 * Later years are entered by the HRMO on the Holidays page (/holidays) from the yearly
 * Malacañang proclamation, so they are not listed here.
 */
export const HOLIDAYS: [date: string, name: string][] = [
  ["2026-01-01", "New Year's Day"],
  ["2026-04-02", "Maundy Thursday"],
  ["2026-04-03", "Good Friday"],
  ["2026-04-09", "Araw ng Kagitingan"],
  ["2026-05-01", "Labor Day"],
  ["2026-06-12", "Independence Day"],
  ["2026-08-21", "Ninoy Aquino Day"],
  ["2026-08-31", "National Heroes Day"],
  ["2026-11-01", "All Saints' Day"],
  ["2026-11-02", "All Souls' Day"],
  ["2026-11-30", "Bonifacio Day"],
  ["2026-12-08", "Feast of the Immaculate Conception"],
  ["2026-12-24", "Christmas Eve"],
  ["2026-12-25", "Christmas Day"],
  ["2026-12-30", "Rizal Day"],
  ["2026-12-31", "Last Day of the Year"],
];

/**
 * The 14 leave types, from src/lib/leave-types.ts. They are updated on every run, so a newer
 * version of the system brings its corrected rules (there is no screen that edits leave types).
 */
export async function seedLeaveTypes(db: PrismaClient) {
  for (const [index, t] of LEAVE_TYPES.entries()) {
    const data = {
      name: t.name,
      legalBasis: t.legalBasis,
      ruleNote: t.ruleNote,
      deductsFrom: t.deductsFrom,
      detailKind: t.detailKind,
      convertible: t.convertible,
      maxDaysPerYear: t.maxDaysPerYear,
      eligibleStatuses: t.eligibleStatuses,
      sortOrder: index + 1,
    };
    await db.leaveType.upsert({ where: { code: t.code }, update: data, create: { code: t.code, ...data } });
  }
}

/**
 * Adds the listed holidays of the given years (all years when none given), but only for a year
 * that has no holiday in the database yet. Once the HRMO has holidays for a year (and may have
 * edited or deleted some on the Holidays page), running the seed again never adds them back.
 * Returns how many holidays were added.
 */
export async function seedHolidays(db: PrismaClient, years?: number[]) {
  const listedYears = [...new Set(HOLIDAYS.map(([date]) => Number(date.slice(0, 4))))];
  let added = 0;
  for (const year of listedYears.filter((y) => !years || years.includes(y))) {
    const existing = await db.holiday.count({ where: { date: { gte: toDbDate(`${year}-01-01`), lte: toDbDate(`${year}-12-31`) } } });
    if (existing > 0) continue;
    const rows = HOLIDAYS.filter(([date]) => date.startsWith(`${year}-`)).map(([date, name]) => ({ date: toDbDate(date), name }));
    added += (await db.holiday.createMany({ data: rows, skipDuplicates: true })).count;
  }
  return added;
}
