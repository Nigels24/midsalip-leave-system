"use server";
// My Profile: save or remove the logged-in user's own e-signature, and change the password.
// Also the action of /change-password, where a new or reset account must pick its own password.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "../lib/db";
import { checkSignatureDataUrl, SIGNATURE_MAX_BYTES } from "../lib/signature";
import { requireSignedIn, requireUser } from "./auth";
import { changeOwnPassword, passwordSchema } from "./employee-rules";
import { LeaveError } from "./leave";

export type ActionResult = { error: string | null };

// null = remove the signature. A string must pass the same check the browser used.
const signatureSchema = z
  .string()
  .max(Math.ceil((SIGNATURE_MAX_BYTES * 4) / 3) + 50, "The signature image is too large (200 KB at most).")
  .superRefine((value, ctx) => {
    const problem = checkSignatureDataUrl(value);
    if (problem) ctx.addIssue({ code: "custom", message: problem });
  })
  .nullable();

export async function setSignatureAction(value: string | null): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = signatureSchema.safeParse(value);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid signature." };

  // Only the user's OWN row: the id comes from the session, never from the browser.
  await db.$transaction([
    db.employee.update({
      where: { id: user.id },
      data: { signature: parsed.data, signatureUpdatedAt: parsed.data ? new Date() : null },
    }),
    db.auditLog.create({
      data: {
        actorId: user.id,
        action: parsed.data ? "UPDATE_SIGNATURE" : "REMOVE_SIGNATURE",
        detail: `${user.username} ${parsed.data ? "saved a new" : "removed their"} e-signature`,
      },
    }),
  ]);

  revalidatePath("/profile");
  return { error: null };
}

export type PasswordState = ActionResult & { message?: string };

/** Reads the three fields and calls changeOwnPassword(). Returns an error message, or null when saved. */
async function savePassword(userId: string, formData: FormData): Promise<string | null> {
  const current = String(formData.get("current") ?? "");
  const parsed = passwordSchema.safeParse(String(formData.get("password") ?? ""));
  if (!current) return "Enter your current password.";
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Invalid password.";
  if (parsed.data !== String(formData.get("confirm") ?? "")) return "The new passwords do not match.";
  try {
    await changeOwnPassword(db, userId, current, parsed.data);
  } catch (error) {
    if (error instanceof LeaveError) return error.message;
    throw error;
  }
  return null;
}

/** My Profile: any user changes their own password (current password required). */
export async function changePasswordAction(_prev: PasswordState, formData: FormData): Promise<PasswordState> {
  const user = await requireUser();
  const error = await savePassword(user.id, formData);
  return error ? { error } : { error: null, message: "Your password was changed." };
}

/**
 * /change-password: the one action allowed while the password must still be changed
 * (requireSignedIn instead of requireUser). On success the app opens normally.
 */
export async function changeRequiredPasswordAction(_prev: PasswordState, formData: FormData): Promise<PasswordState> {
  const user = await requireSignedIn();
  const error = await savePassword(user.id, formData);
  if (error) return { error };
  redirect("/dashboard"); // outside try/catch: redirect() works by throwing
}
