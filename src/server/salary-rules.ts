// Salary schedule (HRMO only): every change to the LGU percentage and to the schedule amounts goes
// through these functions. Like employee-rules.ts, each function takes the database client first,
// runs its writes in one transaction, writes an audit row, and refuses with a LeaveError.
//
// The SalarySchedule table holds the NATIONAL monthly amounts (DBM; for 2026: NBC No. 601, Annex A).
// An LGU pays a percentage of them, set by the Sanggunian according to the LGU's income class
// (DBM Local Budget Circular No. 172 for 2026). The percentage is stored in AppSetting "salaryPercent"
// (100 when not set). The amount this LGU pays is computed by effectiveAmount(), never stored.
//
// Rounding: national amount x percentage, rounded to the nearest peso (half a peso and up rounds up).
// This follows the usual payroll practice of whole-peso salary rates; the HRMO checks the result
// against the salary schedule the Sanggunian approved (the page says so).
import { z } from "zod";
import { Prisma } from "../generated/prisma/client";
import { isValidGradeStep, maxStep, type ScheduleLine, type ScheduleRow } from "../lib/salary-grade";
import { LeaveError } from "./leave/errors";
import { audit, inTransaction, type DbClient } from "./leave/shared";

export const SALARY_PERCENT_KEY = "salaryPercent";
export const DEFAULT_SALARY_PERCENT = "100";

// ── Validation (zod) ─────────────────────────────────────────

/** The LGU percentage: 1 to 100, at most 2 decimals (e.g. "90" or "92.5"). */
export const percentSchema = z
  .string()
  .trim()
  .regex(/^\d{1,3}(\.\d{1,2})?$/, "The percentage is a number from 1 to 100, e.g. 90.")
  .refine((v) => Number(v) >= 1 && Number(v) <= 100, "The percentage is a number from 1 to 100.")
  .transform((v) => new Prisma.Decimal(v));

/** One national amount typed by the HRMO: above zero, at most 2 decimals; commas and ₱ are ignored. */
export const amountSchema = z
  .string()
  .transform((v) => v.replace(/[₱,\s]/g, ""))
  .pipe(z.string().regex(/^\d{1,8}(\.\d{1,2})?$/, "The amount is a number with at most 2 decimals, e.g. 42178."))
  .refine((v) => Number(v) > 0, "The amount must be above zero.")
  .transform((v) => new Prisma.Decimal(v));

export const gradeStepSchema = z
  .object({ grade: z.number().int(), step: z.number().int() })
  .refine((v) => isValidGradeStep(v.grade, v.step), "Unknown salary grade or step.");

// ── Reading ──────────────────────────────────────────────────

/** National amount x percentage, rounded to the nearest peso (half up). */
export function effectiveAmount(national: Prisma.Decimal | string | number, percent: Prisma.Decimal | string | number) {
  return new Prisma.Decimal(national).times(percent).dividedBy(100).toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP);
}

/** The LGU percentage, and whether the HRMO has saved one yet (if not, 100 is used). */
export async function getSalaryPercent(client: DbClient) {
  const row = await client.appSetting.findUnique({ where: { key: SALARY_PERCENT_KEY } });
  return { percent: new Prisma.Decimal(row?.value ?? DEFAULT_SALARY_PERCENT), isSet: Boolean(row) };
}

/**
 * The whole schedule with the national and the effective amount, in grade and step order.
 * Plain values only (strings and numbers), so pages can pass it to client components.
 */
export async function loadSchedule(client: DbClient) {
  const [{ percent }, rows] = await Promise.all([
    getSalaryPercent(client),
    client.salarySchedule.findMany({ orderBy: [{ grade: "asc" }, { step: "asc" }] }),
  ]);
  return rows.map((r) => ({
    grade: r.grade,
    step: r.step,
    national: r.amount.toFixed(2), // "42178.00"
    effective: effectiveAmount(r.amount, percent).toNumber(), // whole pesos, so the number is exact
  }));
}

/** This LGU's schedule as the employee form needs it, for matchSalary() in src/lib/salary-grade.ts. */
export async function loadEffectiveSchedule(client: DbClient): Promise<ScheduleRow[]> {
  return (await loadSchedule(client)).map(({ grade, step, effective }) => ({ grade, step, amount: effective }));
}

// ── Changes ──────────────────────────────────────────────────

const pct = (value: Prisma.Decimal) => `${value.toString()}%`;

/** Saves the LGU percentage. */
export async function setSalaryPercent(client: DbClient, percent: Prisma.Decimal, actorId: string) {
  return inTransaction(client, async (tx) => {
    const before = await getSalaryPercent(tx);
    const value = percent.toString(); // "90", "92.5"
    await tx.appSetting.upsert({ where: { key: SALARY_PERCENT_KEY }, update: { value }, create: { key: SALARY_PERCENT_KEY, value } });
    await audit(tx, actorId, "SET_SALARY_PERCENT", `${before.isSet ? pct(before.percent) : "not set (100%)"} -> ${pct(percent)}`);
  });
}

/** Changes the national amount of one grade and step. */
export async function updateScheduleAmount(client: DbClient, grade: number, step: number, amount: Prisma.Decimal, actorId: string) {
  return inTransaction(client, async (tx) => {
    if (!isValidGradeStep(grade, step)) throw new LeaveError(`SG ${grade} has steps 1 to ${maxStep(grade)}.`);
    const before = await tx.salarySchedule.findUnique({ where: { grade_step: { grade, step } } });
    if (!before) throw new LeaveError(`SG ${grade} Step ${step} is not in the schedule. Use Import to load the schedule first.`);
    if (before.amount.equals(amount)) return; // nothing changed
    await tx.salarySchedule.update({ where: { grade_step: { grade, step } }, data: { amount } });
    await audit(tx, actorId, "UPDATE_SALARY_SCHEDULE", `SG ${grade} Step ${step}: ${before.amount.toFixed(2)} -> ${amount.toFixed(2)} (national)`);
  });
}

/**
 * What an import would do, without saving: how many grade and step rows are new, changed or the same.
 * The rows come from parseScheduleCsv(), which already checked them.
 */
export async function previewScheduleImport(client: DbClient, rows: ScheduleLine[]) {
  const current = await client.salarySchedule.findMany();
  const byKey = new Map(current.map((r) => [`${r.grade}-${r.step}`, r.amount]));
  let added = 0;
  let changed = 0;
  let unchanged = 0;
  for (const row of rows) {
    const old = byKey.get(`${row.grade}-${row.step}`);
    if (!old) added++;
    else if (old.equals(row.amount)) unchanged++;
    else changed++;
  }
  return { added, changed, unchanged, total: rows.length, kept: current.length - changed - unchanged };
}

/**
 * Saves pasted national amounts: each line adds or replaces the amount of its grade and step.
 * Grades and steps that are not in the paste keep their amount. Returns the counts of the preview.
 */
export async function importSchedule(client: DbClient, rows: ScheduleLine[], actorId: string) {
  return inTransaction(client, async (tx) => {
    if (rows.length === 0) throw new LeaveError("Nothing to import: paste lines of grade,step,amount.");
    for (const row of rows) {
      if (!isValidGradeStep(row.grade, row.step)) throw new LeaveError(`SG ${row.grade} has steps 1 to ${maxStep(row.grade)}.`);
    }
    const counts = await previewScheduleImport(tx, rows);
    for (const row of rows) {
      const amount = new Prisma.Decimal(row.amount);
      await tx.salarySchedule.upsert({
        where: { grade_step: { grade: row.grade, step: row.step } },
        update: { amount },
        create: { grade: row.grade, step: row.step, amount },
      });
    }
    await audit(
      tx,
      actorId,
      "IMPORT_SALARY_SCHEDULE",
      `${counts.total} line(s): ${counts.added} added, ${counts.changed} changed, ${counts.unchanged} unchanged (national amounts)`,
    );
    return counts;
  });
}
