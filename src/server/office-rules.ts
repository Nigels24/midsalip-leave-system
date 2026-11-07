// Offices (HRMO only): add an office, or rename its name or short code.
// Offices are never deleted (employees and old applications point to them), and the schema has
// no "active" flag, so an office is never deactivated either.
// A new office starts without a head; fileLeave() refuses filing there until the HRMO sets one.
// Like employee-rules.ts, each function takes the database client first and refuses with a LeaveError.
import { z } from "zod";
import { LeaveError } from "./leave/errors";
import { audit, inTransaction, type DbClient } from "./leave/shared";

export const officeSchema = z.object({
  // The code is the office's id (e.g. "MTO"). Stored in capitals, so "mto" and "MTO" are the same code.
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9-]{2,16}$/, "Short code: 2 to 16 letters, numbers or dashes, e.g. MTO."),
  name: z.string().trim().min(3, "Enter the office name.").max(100, "The office name is too long (100 characters at most)."),
});
export type OfficeInput = z.infer<typeof officeSchema>;

/**
 * Refuses a code or name that another office already uses, in any letter case
 * (PostgreSQL compares text case-sensitively, so mode "insensitive" is needed).
 */
async function checkUnique(tx: DbClient, input: OfficeInput, exceptId?: string) {
  const notThis = exceptId ? { NOT: { id: exceptId } } : {};
  const sameCode = await tx.office.findFirst({ where: { id: { equals: input.code, mode: "insensitive" }, ...notThis } });
  if (sameCode) throw new LeaveError(`The code ${input.code} is already used by the ${sameCode.name}.`);
  const sameName = await tx.office.findFirst({ where: { name: { equals: input.name, mode: "insensitive" }, ...notThis } });
  if (sameName) throw new LeaveError(`There is already an office named "${sameName.name}" (${sameName.id}).`);
}

export async function createOffice(client: DbClient, input: OfficeInput, actorId: string) {
  return inTransaction(client, async (tx) => {
    await checkUnique(tx, input);
    await tx.office.create({ data: { id: input.code, name: input.name } });
    await audit(tx, actorId, "ADD_OFFICE", `${input.code} · ${input.name} (no head yet)`);
  });
}

/**
 * Renames an office. Changing the code changes the office's id: the database updates every
 * employee's officeId with it (ON UPDATE CASCADE), so the head and the employees stay with the office.
 */
export async function updateOffice(client: DbClient, id: string, input: OfficeInput, actorId: string) {
  return inTransaction(client, async (tx) => {
    const before = await tx.office.findUnique({ where: { id } });
    if (!before) throw new LeaveError("Office not found.");
    await checkUnique(tx, input, before.id);
    await tx.office.update({ where: { id: before.id }, data: { id: input.code, name: input.name } });
    await audit(tx, actorId, "UPDATE_OFFICE", `${before.id} · ${before.name} -> ${input.code} · ${input.name}`);
  });
}
