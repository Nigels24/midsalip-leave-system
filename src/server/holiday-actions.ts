"use server";
// Holidays (HRMO only): thin wrappers that check the role, read the form with zod,
// and call the rules in src/server/holiday-rules.ts. A refusal (LeaveError) comes back as { error }.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { rolesFor } from "../config/nav";
import { db } from "../lib/db";
import { requireRole } from "./auth";
import { addHoliday, deleteHoliday, holidaySchema, updateHoliday } from "./holiday-rules";
import { LeaveError } from "./leave";

export type FormState = { error: string | null; message?: string };

const hrmoOnly = () => requireRole(...rolesFor("/holidays"));
const dateParam = z.string().max(10);

async function run(fn: () => Promise<unknown>, message: string): Promise<FormState> {
  try {
    await fn();
  } catch (error) {
    if (error instanceof LeaveError) return { error: error.message };
    throw error;
  }
  revalidatePath("/", "layout"); // the calendar and File Leave read holidays too
  return { error: null, message };
}

const readHoliday = (formData: FormData) =>
  holidaySchema.safeParse({ date: String(formData.get("date") ?? ""), name: String(formData.get("name") ?? "") });

export async function addHolidayAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await hrmoOnly();
  const parsed = readHoliday(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the form." };
  return run(() => addHoliday(db, parsed.data, user.id), `Holiday added: ${parsed.data.name} (${parsed.data.date}).`);
}

export async function updateHolidayAction(originalDate: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const user = await hrmoOnly();
  const parsed = readHoliday(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the form." };
  return run(() => updateHoliday(db, dateParam.parse(originalDate), parsed.data, user.id), "Holiday saved.");
}

export async function deleteHolidayAction(date: string): Promise<FormState> {
  const user = await hrmoOnly();
  return run(() => deleteHoliday(db, dateParam.parse(date), user.id), "Holiday deleted.");
}
