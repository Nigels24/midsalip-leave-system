// Date helpers. Dates are passed around as "YYYY-MM-DD" strings to avoid timezone surprises.
import { eachDayOfInterval, format, isWeekend, parseISO } from "date-fns";

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
