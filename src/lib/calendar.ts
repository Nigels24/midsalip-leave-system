// Leave Calendar helpers (/calendar). Pure functions on "YYYY-MM" and "YYYY-MM-DD" strings,
// tested by verify:engine scenario q. Weeks start on Sunday, as in the prototype.
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isWeekend, parseISO, startOfMonth, startOfWeek } from "date-fns";
import { CALENDAR_DAY_TYPES } from "./leave-types";

/** ?month=2026-11 -> "2026-11". Anything else -> the month of `today`. */
export function parseMonth(value: string | undefined, today: string) {
  return value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) ? value : today.slice(0, 7);
}

/** shiftMonth("2026-01", -1) -> "2025-12" */
export function shiftMonth(month: string, by: number) {
  return format(addMonths(parseISO(`${month}-01`), by), "yyyy-MM");
}

/** "2026-11" -> "November 2026" */
export function monthLabel(month: string) {
  return format(parseISO(`${month}-01`), "MMMM yyyy");
}

export interface CalendarDay {
  iso: string; // "2026-11-01"
  day: number; // 1
  inMonth: boolean; // false for the grey days of the previous and next month
  weekend: boolean;
}

/** Every day shown on the month grid: whole weeks, Sunday to Saturday (28, 35 or 42 days). */
export function monthGrid(month: string): CalendarDay[] {
  const first = parseISO(`${month}-01`);
  const days = eachDayOfInterval({ start: startOfWeek(startOfMonth(first)), end: endOfWeek(endOfMonth(first)) });
  return days.map((d) => ({
    iso: format(d, "yyyy-MM-dd"),
    day: d.getDate(),
    inMonth: format(d, "yyyy-MM") === month,
    weekend: isWeekend(d),
  }));
}

/**
 * The leave that covers this day. Weekends and holidays are skipped (nobody is "on leave" on a
 * day off), except for leave counted in calendar days (ML, SLBW), which runs through them.
 */
export function leaveOnDay<T extends { startDate: string; endDate: string; typeCode: string }>(
  apps: T[],
  day: { iso: string; weekend: boolean },
  holidays: Set<string>,
): T[] {
  const dayOff = day.weekend || holidays.has(day.iso);
  return apps.filter(
    (a) => a.startDate <= day.iso && day.iso <= a.endDate && (!dayOff || CALENDAR_DAY_TYPES.includes(a.typeCode)),
  );
}

/** "2026-02" -> "2026-02-28" */
export function lastDayOfMonth(month: string) {
  return format(endOfMonth(parseISO(`${month}-01`)), "yyyy-MM-dd");
}

/** True for "YYYY-MM" with a real month (01 to 12). */
export const isMonth = (value: unknown): value is string => typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
