"use server";
// Server actions for the leave screens. They only check who is asking and the shape of the input;
// the leave rules themselves are in src/server/leave (fileLeave, cancelApplication).
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { rolesFor } from "../config/nav";
import { db } from "../lib/db";
import { requireRole, requireUser } from "./auth";
import { actOn, cancelApplication, fileLeave, LeaveError } from "./leave";

export type ActionResult = { error: string | null };

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Please select the inclusive dates.");

const fileLeaveSchema = z.object({
  employeeId: z.string().min(1).max(50),
  typeCode: z.string().min(1, "Please select a leave type.").max(10),
  startDate: isoDate,
  endDate: isoDate,
  commutation: z.enum(["NOT_REQUESTED", "REQUESTED"]),
  details: z.record(z.string(), z.string().max(200)),
});

export type FileLeavePayload = z.infer<typeof fileLeaveSchema>;

export async function fileLeaveAction(payload: FileLeavePayload): Promise<ActionResult> {
  const user = await requireRole(...rolesFor("/apply"));

  const parsed = fileLeaveSchema.safeParse(payload);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the form." };
  const input = parsed.data;

  // employeeId comes from the browser, so it is NOT trusted here: fileLeave allows another
  // employee only when the logged-in user (the actor) is an HRMO.
  let applicationId: string;
  try {
    const app = await fileLeave(db, input, user.id);
    applicationId = app.id;
  } catch (error) {
    if (error instanceof LeaveError) return { error: error.message };
    throw error; // a real bug or database problem
  }

  revalidatePath("/applications");
  redirect(`/applications/${applicationId}?filed=1`); // outside try/catch: redirect() works by throwing
}

export async function cancelApplicationAction(applicationId: string): Promise<ActionResult> {
  const user = await requireUser(); // cancelApplication itself allows only the applicant
  try {
    await cancelApplication(db, String(applicationId), user.id);
  } catch (error) {
    if (error instanceof LeaveError) return { error: error.message };
    throw error;
  }
  revalidatePath(`/applications/${applicationId}`);
  revalidatePath("/applications");
  return { error: null };
}

const actSchema = z.object({
  applicationId: z.string().min(1).max(50),
  decision: z.enum(["APPROVE", "DISAPPROVE"]),
  remarks: z.string().max(500, "Remarks are too long (500 characters at most)."),
  // The status the officer saw on screen. actOn refuses if it changed (double click, second tab).
  expectedStatus: z.enum(["FOR_RECOMMENDATION", "FOR_CERTIFICATION", "FOR_APPROVAL"]),
});

/** Recommend / certify / approve, or disapprove, the current step of an application. */
export async function actOnApplicationAction(payload: z.infer<typeof actSchema>): Promise<ActionResult> {
  // Any signed-in user may try; actOn decides whether this person is the assigned officer.
  const user = await requireUser();
  const parsed = actSchema.safeParse(payload);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the form." };
  const { applicationId, decision, remarks, expectedStatus } = parsed.data;

  try {
    await actOn(db, applicationId, user.id, decision, remarks, expectedStatus);
  } catch (error) {
    if (error instanceof LeaveError) return { error: error.message };
    throw error;
  }
  // Refresh every page: the detail page, both lists and the sidebar badge in the layout.
  revalidatePath("/", "layout");
  return { error: null };
}
