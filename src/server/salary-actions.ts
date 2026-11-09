"use server";
// Salary Schedule (HRMO only): thin wrappers that check the role, read the input with zod,
// and call the rules in src/server/salary-rules.ts. A refusal (LeaveError) comes back as { error }.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { rolesFor } from "../config/nav";
import { db } from "../lib/db";
import { parseScheduleCsv } from "../lib/salary-grade";
import { requireRole } from "./auth";
import { LeaveError } from "./leave";
import { amountSchema, gradeStepSchema, importSchedule, percentSchema, previewScheduleImport, setSalaryPercent, updateScheduleAmount } from "./salary-rules";

export type FormState = { error: string | null; message?: string };

const hrmoOnly = () => requireRole(...rolesFor("/salary-schedule"));
const firstIssue = (error: z.ZodError) => error.issues[0]?.message ?? "Please check the form.";
const pasted = z.string().max(50_000, "The pasted text is too long.");

async function run(fn: () => Promise<unknown>, message: string): Promise<FormState> {
  try {
    await fn();
  } catch (error) {
    if (error instanceof LeaveError) return { error: error.message };
    throw error;
  }
  revalidatePath("/", "layout"); // the employee forms use the schedule too
  return { error: null, message };
}

export async function setSalaryPercentAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await hrmoOnly();
  const parsed = percentSchema.safeParse(String(formData.get("percent") ?? ""));
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  return run(() => setSalaryPercent(db, parsed.data, user.id), `Percentage saved: ${parsed.data.toString()}%.`);
}

export async function updateScheduleAmountAction(grade: number, step: number, formData: FormData): Promise<FormState> {
  const user = await hrmoOnly();
  const where = gradeStepSchema.safeParse({ grade, step });
  if (!where.success) return { error: firstIssue(where.error) };
  const amount = amountSchema.safeParse(String(formData.get("amount") ?? ""));
  if (!amount.success) return { error: firstIssue(amount.error) };
  return run(() => updateScheduleAmount(db, grade, step, amount.data, user.id), `SG ${grade} Step ${step} saved.`);
}

export type ImportPreview = {
  error: string | null;
  errors: string[];
  counts?: { added: number; changed: number; unchanged: number; total: number; kept: number };
};

/** Checks a pasted schedule and counts what would change. Saves nothing. */
export async function previewImportAction(text: string): Promise<ImportPreview> {
  await hrmoOnly();
  const input = pasted.safeParse(text);
  if (!input.success) return { error: firstIssue(input.error), errors: [] };
  const { rows, errors } = parseScheduleCsv(input.data);
  if (errors.length > 0) return { error: "Fix these lines first. Nothing was saved.", errors };
  if (rows.length === 0) return { error: "Nothing to import: paste lines of grade,step,amount.", errors: [] };
  return { error: null, errors: [], counts: await previewScheduleImport(db, rows) };
}

/** Saves a pasted schedule. It is parsed and checked again here: the server decides, not the preview. */
export async function importScheduleAction(text: string): Promise<FormState> {
  const user = await hrmoOnly();
  const input = pasted.safeParse(text);
  if (!input.success) return { error: firstIssue(input.error) };
  const { rows, errors } = parseScheduleCsv(input.data);
  if (errors.length > 0) return { error: errors[0] };
  let saved = { added: 0, changed: 0 };
  const result = await run(async () => {
    saved = await importSchedule(db, rows, user.id);
  }, "");
  return result.error ? result : { error: null, message: `Schedule imported: ${saved.added} added, ${saved.changed} changed.` };
}
