// Salary grade and step helpers. Pure functions with no database and no Prisma.Decimal, so the
// employee form (a client component) can use them too. Tested by verify:engine scenario w.
//
// The schedule has grades 1 to 33 with 8 steps each, except grade 33, which has only steps 1 and 2
// (DBM National Budget Circular No. 601, Annex A). The amounts the form looks up are this LGU's
// EFFECTIVE amounts (national amount x the LGU percentage, rounded to the peso by
// effectiveAmount() in src/server/salary-rules.ts), so they are always whole pesos.
//
// Money is compared in centavos as whole numbers (14634.50 -> 1463450), never as JS decimals.
import type { EmploymentStatus } from "../generated/prisma/client";

export const MAX_GRADE = 33;

/** Number of steps in a grade: 8, or 2 for grade 33. */
export function maxStep(grade: number) {
  return grade === MAX_GRADE ? 2 : 8;
}

/** True for a whole-number grade 1..33 and step 1..maxStep(grade). */
export function isValidGradeStep(grade: number, step: number) {
  return Number.isInteger(grade) && Number.isInteger(step) && grade >= 1 && grade <= MAX_GRADE && step >= 1 && step <= maxStep(grade);
}

/** Every grade and step in order: (1,1), (1,2) ... (33,2). 258 in total. */
export function allGradeSteps() {
  const list: { grade: number; step: number }[] = [];
  for (let grade = 1; grade <= MAX_GRADE; grade++) {
    for (let step = 1; step <= maxStep(grade); step++) list.push({ grade, step });
  }
  return list;
}

// ── Who has a salary grade ───────────────────────────────────
// COS (Contract of Service) and JO (Job Order) workers are paid by contract, not from the salary
// schedule, so they have no grade or step. Elective officials may have one (e.g. the mayor, SG 27),
// but it is optional. Everyone else (Permanent, Casual, Coterminous) must have a grade.
export const NO_GRADE_STATUSES: EmploymentStatus[] = ["COS", "JO"];
export const OPTIONAL_GRADE_STATUSES: EmploymentStatus[] = ["ELECTIVE"];

export const hasNoGrade = (status: string) => NO_GRADE_STATUSES.includes(status as EmploymentStatus);
export const gradeRequired = (status: string) => !hasNoGrade(status) && !OPTIONAL_GRADE_STATUSES.includes(status as EmploymentStatus);

// ── Money in centavos ────────────────────────────────────────

/**
 * A peso amount typed by a person -> centavos, or null if it is not a valid amount.
 * Accepts "33611", "33,611", "₱ 33,611.50". At most 2 decimals and 9 digits before the point.
 */
export function toCentavos(text: string): number | null {
  const clean = text.replace(/[₱,\s]/g, "");
  const match = /^(\d{1,9})(?:\.(\d{1,2}))?$/.exec(clean);
  if (!match) return null;
  return Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
}

// ── Monthly salary -> grade and step ─────────────────────────

/** One row of this LGU's effective schedule, as the employee form receives it (whole pesos). */
export interface ScheduleRow {
  grade: number;
  step: number;
  amount: number;
}

export type SalaryMatch =
  | { kind: "none" } // nothing typed, not a number, or the schedule is empty
  | { kind: "exact"; grade: number; step: number }
  | { kind: "closest"; grade: number; step: number; amount: number } // highest amount at or below the salary
  | { kind: "below"; lowest: number }; // below the lowest amount of the schedule (SG 1 Step 1)

/**
 * Finds the grade and step of a monthly salary in this LGU's schedule:
 *   - "exact": the salary is exactly the amount of a grade and step;
 *   - "closest": no exact amount, so the grade and step with the highest amount still at or below
 *     the salary (the HRMO must confirm it);
 *   - "below": the salary is less than every amount in the schedule.
 * If two rows have the same amount, the lower grade and step wins.
 */
export function matchSalary(typed: string, schedule: ScheduleRow[]): SalaryMatch {
  const salary = toCentavos(typed);
  if (salary === null || salary === 0 || schedule.length === 0) return { kind: "none" };

  const sorted = [...schedule].sort((a, b) => a.grade - b.grade || a.step - b.step);
  const exact = sorted.find((row) => row.amount * 100 === salary);
  if (exact) return { kind: "exact", grade: exact.grade, step: exact.step };

  let best: ScheduleRow | null = null;
  for (const row of sorted) {
    if (row.amount * 100 <= salary && (!best || row.amount > best.amount)) best = row;
  }
  if (!best) return { kind: "below", lowest: Math.min(...sorted.map((row) => row.amount)) };
  return { kind: "closest", grade: best.grade, step: best.step, amount: best.amount };
}

// ── Pasted schedule (yearly update) ──────────────────────────

/** A valid line of a pasted schedule. The amount stays a string, so the server makes it a Prisma.Decimal exactly. */
export interface ScheduleLine {
  grade: number;
  step: number;
  amount: string; // e.g. "14634" or "14634.50", no commas
}

/** Most lines one paste may have (the whole schedule is 258). */
export const MAX_IMPORT_LINES = 300;

/**
 * Reads pasted lines of "grade,step,amount". Also accepts tab-separated lines (copied from Excel),
 * an optional header line ("grade,step,amount"), blank lines, a peso sign, and thousands commas in
 * the amount ("1,1,14,634" and "1,1,\"14,634\"" both read as 14634).
 * Checks: grade 1 to 33, step 1 to 8 (2 for grade 33), an amount above zero with at most 2 decimals,
 * and no grade and step twice. Returns the good lines and one message per bad line.
 */
export function parseScheduleCsv(text: string): { rows: ScheduleLine[]; errors: string[] } {
  const rows: ScheduleLine[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();
  const lines = text.split(/\r?\n/);
  // +1 for an optional header line
  if (lines.filter((l) => l.trim()).length > MAX_IMPORT_LINES + 1) {
    return { rows, errors: [`Too many lines: at most ${MAX_IMPORT_LINES}.`] };
  }

  lines.forEach((raw, index) => {
    const line = raw.trim();
    const where = `Line ${index + 1}`;
    if (!line) return;
    if (rows.length === 0 && errors.length === 0 && /[a-z]/i.test(line)) return; // header line

    const fields = line.includes("\t") ? line.split("\t") : line.split(",");
    if (fields.length < 3) return void errors.push(`${where}: expected grade, step and amount, e.g. 1,1,14634.`);
    const [gradeText, stepText, ...amountParts] = fields.map((f) => f.trim());
    const amountText = amountParts.join("").replace(/["₱\s,]/g, "");

    const grade = /^\d{1,2}$/.test(gradeText) ? Number(gradeText) : NaN;
    const step = /^\d{1,2}$/.test(stepText) ? Number(stepText) : NaN;
    if (!(grade >= 1 && grade <= MAX_GRADE)) return void errors.push(`${where}: the grade must be 1 to ${MAX_GRADE}.`);
    if (!isValidGradeStep(grade, step)) return void errors.push(`${where}: SG ${grade} has steps 1 to ${maxStep(grade)}.`);
    if (!/^\d{1,8}(\.\d{1,2})?$/.test(amountText) || Number(amountText) <= 0) {
      return void errors.push(`${where}: the amount must be a number above zero with at most 2 decimals.`);
    }
    const key = `${grade}-${step}`;
    if (seen.has(key)) return void errors.push(`${where}: SG ${grade} Step ${step} appears twice.`);
    seen.add(key);
    rows.push({ grade, step, amount: amountText });
  });

  return { rows, errors };
}
