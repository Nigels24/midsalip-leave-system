"use server";
// My Profile: save or remove the logged-in user's own e-signature.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "../lib/db";
import { checkSignatureDataUrl, SIGNATURE_MAX_BYTES } from "../lib/signature";
import { requireUser } from "./auth";
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

/** Any user changes their own password (current password required). */
export async function changePasswordAction(_prev: ActionResult & { message?: string }, formData: FormData): Promise<ActionResult & { message?: string }> {
  const user = await requireUser();
  const current = String(formData.get("current") ?? "");
  const parsed = passwordSchema.safeParse(String(formData.get("password") ?? ""));
  if (!current) return { error: "Enter your current password." };
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid password." };
  if (parsed.data !== String(formData.get("confirm") ?? "")) return { error: "The new passwords do not match." };

  try {
    await changeOwnPassword(db, user.id, current, parsed.data);
  } catch (error) {
    if (error instanceof LeaveError) return { error: error.message };
    throw error;
  }
  return { error: null, message: "Your password was changed." };
}
