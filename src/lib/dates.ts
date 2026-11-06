// Date helpers. Dates are passed around as "YYYY-MM-DD" strings to avoid timezone surprises.
import { differenceInCalendarDays, eachDayOfInterval, format, isValid, isWeekend, parseISO } from "date-fns";

/**
 * Number of working days from start to end, counting both ends.
 * Saturdays, Sundays and holidays are not counted.
 * Example: workingDaysBetween("2026-11-27", "2026-12-01", ["2026-11-30"]) === 2
 */
export function workingDaysBetween(start: string, end: string, holidays: Iterable<string> = []): number {
  const startDay = parseISO(start);
  const endDay = parseISO(end);
  if (endDay < startDay) return 0;

  const holidaySet = new Set(holidays);
  return eachDayOfInterval({ start: startDay, end: endDay }).filter(
    (day) => !isWeekend(day) && !holidaySet.has(format(day, "yyyy-MM-dd")),
  ).length;
}

/**
 * "2026-01-31" -> Date for a Prisma @db.Date column.
 * Midnight UTC, because Prisma writes the UTC calendar day into the PostgreSQL DATE column
 * and reads it back as midnight UTC, so the stored day never shifts with the server timezone.
 */
export const toDbDate = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

/** Date read from a @db.Date column -> "2026-01-31". */
export const fromDbDate = (date: Date) => date.toISOString().slice(0, 10);

/**
 * Number of calendar days from start to end, counting both ends (weekends and holidays included).
 * Used for Maternity Leave and Special Leave Benefits for Women, which the law counts in calendar days.
 */
export function calendarDaysBetween(start: string, end: string): number {
  const days = differenceInCalendarDays(parseISO(end), parseISO(start)) + 1;
  return Math.max(days, 0);
}

/**
 * Today as "YYYY-MM-DD" in Philippine time, whatever time zone the server PC is set to.
 * ("en-CA" is used only because it formats dates as YYYY-MM-DD.)
 */
export function todayInManila(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** "2026-12-01" -> 2026 */
export const yearOf = (isoDate: string) => Number(isoDate.slice(0, 4));

/** True for a real calendar date written as "YYYY-MM-DD" (rejects "2026-02-30"). */
export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = parseISO(value);
  return isValid(date) && format(date, "yyyy-MM-dd") === value;
}
