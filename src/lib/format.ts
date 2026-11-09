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

/** "Tuesday" */
export function fmtWeekday(value: string | Date) {
  return toDate(value).toLocaleDateString("en-PH", { timeZone: TZ, weekday: "long" });
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

/** 25000 -> "₱25,000" (as on the prototype's CS Form 6). Accepts numbers, strings and Prisma.Decimal. */
export function peso(value: number | string | { toString(): string }) {
  return Number(value.toString()).toLocaleString("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 });
}

/** "SG 15", "SG 15 Step 3", or "" when there is no grade (COS, JO, some elective officials). Never "SG null". */
export function fmtSalaryGrade(grade: number | null, step: number | null = null) {
  if (grade === null) return "";
  return step === null ? `SG ${grade}` : `SG ${grade} Step ${step}`;
}

/** "Saturday, November 7, 2026": today's date in the Philippines, for the dashboard greeting. */
export function fmtToday(now: Date = new Date()) {
  return now.toLocaleDateString("en-PH", { timeZone: TZ, weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

/** "Good morning" / "Good afternoon" / "Good evening" by the hour in the Philippines. */
export function greeting(now: Date = new Date()) {
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", hourCycle: "h23" }).format(now));
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

/** "Pepito, Joanna R." -> "PEPITO, JOANNA R.": a name in capitals, as printed on CS Form 6 (item 2 and the signature lines). */
export function upperName(name: string) {
  return name.toLocaleUpperCase("en-PH");
}

/**
 * 1 -> "1 day", 2 -> "2 days", 0.5 -> "0.5 days", 0 -> "0 days" (only exactly 1 is singular). Accepts numbers, strings and Prisma.Decimal.
 * `kind` adds a word in front of "day", e.g. pluralDays(3, "calendar") -> "3 calendar days".
 */
export function pluralDays(value: number | string | { toString(): string }, kind = "") {
  const word = Number(value.toString()) === 1 ? "day" : "days";
  return `${fmtNum(value)} ${kind ? `${kind} ` : ""}${word}`;
}
