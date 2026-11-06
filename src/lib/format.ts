// Display formatting (dates in Philippine time, numbers). Used by server and client components.
// For DISPLAY only: never do leave math with these results.

const TZ = "Asia/Manila";

/** "YYYY-MM-DD" (a calendar date) or a Date (a moment in time) -> Date to format. */
function toDate(value: string | Date) {
  // A "YYYY-MM-DD" string is read as midnight UTC, which is 8:00 AM the same day in Manila,
  // so the calendar date never shifts. @db.Date columns come back the same way.
  return typeof value === "string" ? new Date(`${value.slice(0, 10)}T00:00:00Z`) : value;
}

/** "Dec 1, 2026" */
export function fmtDate(value: string | Date | null | undefined) {
  if (!value) return "—";
  return toDate(value).toLocaleDateString("en-PH", { timeZone: TZ, month: "short", day: "numeric", year: "numeric" });
}

/** "December 1, 2026" */
export function fmtDateLong(value: string | Date) {
  return toDate(value).toLocaleDateString("en-PH", { timeZone: TZ, month: "long", day: "numeric", year: "numeric" });
}

/** "Dec 1, 2026, 9:15 AM" in Philippine time, whatever the server's time zone is. */
export function fmtDateTime(value: Date | string) {
  return new Date(value).toLocaleString("en-PH", {
    timeZone: TZ,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** "Dec 1, 2026" or "Dec 1, 2026 – Dec 3, 2026" */
export function fmtRange(start: string | Date, end: string | Date) {
  const a = fmtDate(start);
  const b = fmtDate(end);
  return a === b ? a : `${a} – ${b}`;
}

/** 2.5 -> "2.5", 122.25 -> "122.25", 1.2345 -> "1.235". Accepts numbers, strings and Prisma.Decimal. */
export function fmtNum(value: number | string | { toString(): string }) {
  return Number(value.toString()).toLocaleString("en-PH", { maximumFractionDigits: 3 });
}
