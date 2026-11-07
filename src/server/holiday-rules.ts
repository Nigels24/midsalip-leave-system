// Holidays (HRMO only): every add, edit and delete of a holiday goes through these functions.
// Working days are counted from the Holiday table when a leave is FILED (src/server/leave/filing.ts),
// and the number of days is saved on the application. So a change here affects only leave filed
// from now on: applications already filed are never recounted.
// Like employee-rules.ts, each function takes the database client first and refuses with a LeaveError.
import { z } from "zod";
import { fromDbDate, isIsoDate, toDbDate } from "../lib/dates";
import { fmtDate } from "../lib/format";
import { LeaveError } from "./leave/errors";
import { audit, inTransaction, type DbClient } from "./leave/shared";

export const holidaySchema = z.object({
  date: z.string().trim().refine(isIsoDate, "Enter a valid date."),
  name: z.string().trim().min(1, "The holiday name is required.").max(100, "The name is too long (100 characters at most)."),
});
export type HolidayInput = z.infer<typeof holidaySchema>;

/** Refuses a date that already has a holiday (the date is the table's primary key). */
async function checkFreeDate(tx: DbClient, date: string) {
  const other = await tx.holiday.findUnique({ where: { date: toDbDate(date) } });
  if (other) throw new LeaveError(`${fmtDate(date)} is already a holiday (${other.name}). Edit that one instead.`);
}

async function loadHoliday(tx: DbClient, date: string) {
  if (!isIsoDate(date)) throw new LeaveError("Holiday not found.");
  const holiday = await tx.holiday.findUnique({ where: { date: toDbDate(date) } });
  if (!holiday) throw new LeaveError("Holiday not found. It may have been deleted already.");
  return { date: fromDbDate(holiday.date), name: holiday.name };
}

export async function addHoliday(client: DbClient, input: HolidayInput, actorId: string) {
  return inTransaction(client, async (tx) => {
    await checkFreeDate(tx, input.date);
    await tx.holiday.create({ data: { date: toDbDate(input.date), name: input.name } });
    await audit(tx, actorId, "ADD_HOLIDAY", `${input.date} · ${input.name}`);
  });
}

/** Changes the date and/or the name of the holiday on `originalDate`. */
export async function updateHoliday(client: DbClient, originalDate: string, input: HolidayInput, actorId: string) {
  return inTransaction(client, async (tx) => {
    const before = await loadHoliday(tx, originalDate);
    if (input.date !== before.date) await checkFreeDate(tx, input.date);
    await tx.holiday.update({ where: { date: toDbDate(before.date) }, data: { date: toDbDate(input.date), name: input.name } });
    await audit(tx, actorId, "UPDATE_HOLIDAY", `${before.date} · ${before.name} -> ${input.date} · ${input.name}`);
  });
}

export async function deleteHoliday(client: DbClient, date: string, actorId: string) {
  return inTransaction(client, async (tx) => {
    const before = await loadHoliday(tx, date);
    await tx.holiday.delete({ where: { date: toDbDate(before.date) } });
    await audit(tx, actorId, "DELETE_HOLIDAY", `${before.date} · ${before.name}`);
  });
}
