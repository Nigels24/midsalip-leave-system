"use server";
// Employees & Accounts (HRMO only): thin wrappers that check the role, read the form,
// and call the rules in src/server/employee-rules.ts, src/server/office-rules.ts or src/server/leave/accrual.ts.
// A refusal (LeaveError) comes back as { error } for the form to show.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { rolesFor } from "../config/nav";
import { db } from "../lib/db";
import { todayInManila } from "../lib/dates";
import { requireRole } from "./auth";
import {
  createEmployee,
  employeeFieldsSchema,
  newEmployeeSchema,
  passwordSchema,
  resetPassword,
  setEmployeeActive,
  setOfficeHead,
  updateEmployee,
} from "./employee-rules";
import { LeaveError, postAccrual } from "./leave";
import { createOffice, officeSchema, updateOffice } from "./office-rules";

export type FormState = { error: string | null; message?: string };

const hrmoOnly = () => requireRole(...rolesFor("/employees"));
const idSchema = z.string().min(1).max(64);

/** Runs a rule; a LeaveError becomes the form's error message. Any other error is a bug and is thrown. */
async function run(fn: () => Promise<unknown>, message: string): Promise<FormState> {
  try {
    await fn();
  } catch (error) {
    if (error instanceof LeaveError) return { error: error.message };
    throw error;
  }
  revalidatePath("/", "layout");
  return { error: null, message };
}

const firstIssue = (error: z.ZodError) => error.issues[0]?.message ?? "Please check the form.";
const text = (formData: FormData, name: string) => String(formData.get(name) ?? "");

/** The editable fields from the form. */
const readFields = (formData: FormData) => ({
  employeeNo: text(formData, "employeeNo"),
  firstName: text(formData, "firstName"),
  middleInitial: text(formData, "middleInitial"),
  lastName: text(formData, "lastName"),
  sex: text(formData, "sex"),
  position: text(formData, "position"),
  salaryGrade: text(formData, "salaryGrade"),
  monthlySalary: text(formData, "monthlySalary"),
  officeId: text(formData, "officeId"),
  status: text(formData, "status"),
  role: text(formData, "role"),
  originalAppointment: text(formData, "originalAppointment"),
});

export async function createEmployeeAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await hrmoOnly();
  const parsed = newEmployeeSchema.safeParse({
    ...readFields(formData),
    username: text(formData, "username"),
    password: text(formData, "password"),
    openingVL: text(formData, "openingVL"),
    openingSL: text(formData, "openingSL"),
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  let id = "";
  const result = await run(async () => {
    id = await createEmployee(db, parsed.data, user.id);
  }, "Employee added.");
  if (result.error) return result;
  redirect(`/employees/${id}?created=1`); // outside try/catch: redirect() works by throwing
}

export async function updateEmployeeAction(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const user = await hrmoOnly();
  const parsed = employeeFieldsSchema.safeParse(readFields(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  return run(() => updateEmployee(db, idSchema.parse(id), parsed.data, user.id), "Changes saved.");
}

export async function setEmployeeActiveAction(id: string, active: boolean): Promise<FormState> {
  const user = await hrmoOnly();
  return run(() => setEmployeeActive(db, idSchema.parse(id), active === true, user.id), active ? "Account reactivated." : "Account deactivated.");
}

export async function resetPasswordAction(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const user = await hrmoOnly();
  const parsed = passwordSchema.safeParse(text(formData, "password"));
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  if (parsed.data !== text(formData, "confirm")) return { error: "The two passwords do not match." };
  return run(() => resetPassword(db, idSchema.parse(id), parsed.data, user.id), "Password reset. Give the new temporary password to the employee.");
}

export async function setOfficeHeadAction(officeId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const user = await hrmoOnly();
  const employeeId = idSchema.safeParse(text(formData, "headId"));
  if (!employeeId.success) return { error: "Choose the new head." };
  return run(() => setOfficeHead(db, idSchema.parse(officeId), employeeId.data, user.id), "Office head changed.");
}

const readOffice = (formData: FormData) => officeSchema.safeParse({ code: text(formData, "code"), name: text(formData, "name") });

export async function createOfficeAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await hrmoOnly();
  const parsed = readOffice(formData);
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  return run(() => createOffice(db, parsed.data, user.id), `Office added: ${parsed.data.name}. Set its head next.`);
}

export async function updateOfficeAction(officeId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const user = await hrmoOnly();
  const parsed = readOffice(formData);
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  return run(() => updateOffice(db, idSchema.parse(officeId), parsed.data, user.id), "Office renamed.");
}

export async function postAccrualAction(month: string): Promise<FormState> {
  const user = await hrmoOnly();
  const parsed = z.string().max(7).safeParse(month);
  if (!parsed.success) return { error: "Please choose a valid month." };
  let posted = 0;
  const result = await run(async () => {
    posted = (await postAccrual(db, parsed.data, user.id, todayInManila())).employees;
  }, "");
  return result.error ? result : { error: null, message: `Credits posted to ${posted} employee(s).` };
}
