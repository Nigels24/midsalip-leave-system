// Monthly leave credit posting (CSC rule: 1.25 days VL and 1.25 days SL per month of service).
// Same as the prototype's postAccrual, except the HRMO picks the month (never a future one).
// Who earns: active employees whose employment status is in CREDIT_EARNING_STATUSES
// (src/lib/leave-types.ts), appointed on or before the last day of that month.
import { Prisma } from "../../generated/prisma/client";
import { isMonth, lastDayOfMonth, monthLabel } from "../../lib/calendar";
import { MONTHLY_ACCRUAL } from "../../lib/constants";
import { toDbDate } from "../../lib/dates";
import { CREDIT_EARNING_STATUSES } from "../../lib/leave-types";
import { fullName } from "../../lib/utils";
import { LeaveError } from "./errors";
import { audit, inTransaction, notify, type DbClient } from "./shared";

/** Checks the month: "YYYY-MM" and not after the current month (today is "YYYY-MM-DD" in Manila). */
function checkMonth(month: string, today: string) {
  if (!isMonth(month)) throw new LeaveError("Please choose a valid month.");
  if (month > today.slice(0, 7)) throw new LeaveError("Credits cannot be posted for a future month.");
}

/**
 * Who would receive credits for the month (read only, for the preview page):
 *   toPost:         active credit earners with nothing posted yet for that month;
 *   alreadyPosted:  how many earners already have that month on their leave card;
 *   notYetHired:    how many earners were appointed after the month ended.
 */
export async function accrualPreview(client: DbClient, month: string, today: string) {
  checkMonth(month, today);
  const lastDay = toDbDate(lastDayOfMonth(month));
  const earners = await client.employee.findMany({
    where: { active: true, status: { in: CREDIT_EARNING_STATUSES } },
    select: { id: true, firstName: true, middleInitial: true, lastName: true, officeId: true, originalAppointment: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
  const posted = await client.ledgerEntry.findMany({ where: { accrualMonth: month }, select: { employeeId: true }, distinct: ["employeeId"] });
  const postedIds = new Set(posted.map((p) => p.employeeId));

  const hired = earners.filter((e) => e.originalAppointment <= lastDay);
  const toPost = hired.filter((e) => !postedIds.has(e.id));
  return {
    toPost: toPost.map((e) => ({ id: e.id, name: fullName(e), officeId: e.officeId })),
    alreadyPosted: hired.length - toPost.length,
    notYetHired: earners.length - hired.length,
  };
}

/**
 * Posts 1.25 VL and 1.25 SL for the month to everyone in the preview, in one transaction.
 * Running it twice never doubles a month: LedgerEntry is unique per employee + kind + accrualMonth,
 * and createMany({ skipDuplicates }) skips rows that already exist (even if two HRMOs click at once).
 * The entry is dated the last day of the month, or today if the month is not over yet,
 * so the credits count right away (balance as of today).
 */
export async function postAccrual(client: DbClient, month: string, actorId: string, today: string) {
  return inTransaction(client, async (tx) => {
    const { toPost } = await accrualPreview(tx, month, today);
    if (toPost.length === 0) throw new LeaveError(`Nothing to post: every eligible employee already has credits for ${monthLabel(month)}.`);

    const lastDay = lastDayOfMonth(month);
    const date = toDbDate(lastDay < today ? lastDay : today);
    const earned = new Prisma.Decimal(MONTHLY_ACCRUAL);
    const particulars = `Earned – ${monthLabel(month)}`;
    const result = await tx.ledgerEntry.createMany({
      data: toPost.flatMap((e) =>
        (["VL", "SL"] as const).map((kind) => ({ employeeId: e.id, kind, accrualMonth: month, date, particulars, earned })),
      ),
      skipDuplicates: true,
    });
    if (result.count === 0) throw new LeaveError(`Credits for ${monthLabel(month)} were just posted by someone else.`);

    await notify(
      tx,
      toPost.map((e) => e.id),
      "Leave credits posted",
      `${MONTHLY_ACCRUAL} VL and ${MONTHLY_ACCRUAL} SL credits were added for ${monthLabel(month)}.`,
    );
    await audit(tx, actorId, "POST_ACCRUAL", `${monthLabel(month)} · ${toPost.length} employees · ${result.count} ledger entries`);

    // Remember the latest month posted (shown on the posting page).
    const last = await tx.appSetting.findUnique({ where: { key: "lastAccrualMonth" } });
    if (!last || last.value < month) {
      await tx.appSetting.upsert({ where: { key: "lastAccrualMonth" }, update: { value: month }, create: { key: "lastAccrualMonth", value: month } });
    }
    return { month, employees: toPost.length, entries: result.count };
  });
}
