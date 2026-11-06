// Filing a leave application (CS Form No. 6). Port of the prototype's validateFile + fileLeave,
// plus the panel revisions: eligibility by employment type, yearly allowance, and who filed it.
import { Prisma, type Commutation, type LeaveDetailKind } from "../../generated/prisma/client";
import { OPEN_STATUSES } from "../../lib/constants";
import { fromDbDate, isIsoDate, toDbDate, todayInManila, yearOf } from "../../lib/dates";
import { countLeaveDays, LEAVE_LOCATIONS, SICK_WHERE, STUDY_PURPOSES } from "../../lib/leave-types";
import { makeRefNo } from "../../lib/refno";
import { fullName } from "../../lib/utils";
import { validateEligibility } from "./eligibility";
import { LeaveError } from "./errors";
import { audit, inTransaction, notify, type DbClient } from "./shared";
import { actorsFor } from "./workflow";

export interface FileLeaveInput {
  employeeId: string; // whose leave it is
  typeCode: string;
  details: Record<string, unknown>; // see LeaveDetails in src/lib/leave-types.ts
  startDate: string; // "YYYY-MM-DD"
  endDate: string;
  commutation: Commutation;
}

/** Holidays between two dates as "YYYY-MM-DD" strings (from the Holiday table). */
export async function loadHolidays(client: DbClient, start: string, end: string) {
  const rows = await client.holiday.findMany({ where: { date: { gte: toDbDate(start), lte: toDbDate(end) } } });
  return rows.map((h) => fromDbDate(h.date));
}

const MAX_TEXT = 200;
const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

/**
 * Checks the "Details of Leave" the leave type needs and keeps only the known fields,
 * so nothing unexpected from the browser is saved in the details column.
 */
const DETAIL_FIELDS: Record<LeaveDetailKind, string[]> = {
  VACATION: ["location", "locationSpec"],
  SICK: ["sickWhere", "illness"],
  STUDY: ["study"],
  WOMEN: ["womenIllness"],
  NONE: [],
};

function cleanDetails(kind: LeaveDetailKind, raw: Record<string, unknown>) {
  const result: Record<string, string> = {};
  for (const key of [...DETAIL_FIELDS[kind], "others"]) {
    const value = text(raw[key]);
    if (value.length > MAX_TEXT) throw new LeaveError(`Details are too long (${MAX_TEXT} characters at most).`);
    if (value) result[key] = value;
  }

  if (kind === "VACATION" && !LEAVE_LOCATIONS.includes(result.location)) throw new LeaveError("Please indicate where the leave will be spent.");
  if (kind === "SICK" && !SICK_WHERE.includes(result.sickWhere)) throw new LeaveError("Please indicate In Hospital or Out Patient.");
  if (kind === "SICK" && !result.illness) throw new LeaveError("Please specify the illness.");
  if (kind === "STUDY" && !STUDY_PURPOSES.includes(result.study)) throw new LeaveError("Please select the purpose of the study leave.");
  if (kind === "WOMEN" && !result.womenIllness) throw new LeaveError("Please specify the illness.");
  return result;
}

/** A reference number nobody has yet. Checked first, because a failed insert would abort the transaction. */
async function newRefNo(tx: DbClient) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const refNo = makeRefNo(yearOf(todayInManila()));
    if (!(await tx.leaveApplication.findUnique({ where: { refNo }, select: { id: true } }))) return refNo;
  }
  throw new Error("Could not generate a unique reference number."); // practically impossible: 32^8 combinations
}

/**
 * Files a leave application. actorId = the logged-in person who encodes it (panel revision 6):
 * the employee for himself, or an HRMO on behalf of any active employee.
 * All checks run before the first write, so a refused application leaves nothing behind.
 */
export async function fileLeave(client: DbClient, input: FileLeaveInput, actorId: string) {
  return inTransaction(client, async (tx) => {
    // 1. Who may file for whom.
    const actor = await tx.employee.findUnique({ where: { id: actorId } });
    if (!actor || !actor.active) throw new LeaveError("Your account is not active.");
    const onBehalf = actor.id !== input.employeeId;
    if (onBehalf && actor.role !== "HRMO") {
      throw new LeaveError("You can only file leave for yourself. Only the HRMO may file on behalf of another employee.");
    }

    // 2. Lock the applicant's row until this transaction ends, so two filings for the same
    //    person run one after the other and cannot both spend the same credits or dates.
    await tx.$queryRaw`SELECT id FROM "Employee" WHERE id = ${input.employeeId} FOR UPDATE`;
    const employee = await tx.employee.findUnique({ where: { id: input.employeeId }, include: { office: true } });
    if (!employee || !employee.active) throw new LeaveError("Employee not found or the account is deactivated.");
    const type = await tx.leaveType.findUnique({ where: { code: input.typeCode } });
    if (!type) throw new LeaveError("Please select a leave type.");

    // 3. Dates and number of days (calendar days for ML/SLBW, otherwise working days).
    const { startDate, endDate } = input;
    if (!isIsoDate(startDate) || !isIsoDate(endDate)) throw new LeaveError("Please select the inclusive dates.");
    if (endDate < startDate) throw new LeaveError("The end date cannot be earlier than the start date.");
    const dayCount = countLeaveDays(type.code, startDate, endDate, await loadHolidays(tx, startDate, endDate));
    if (dayCount <= 0) {
      throw new LeaveError("The selected dates contain no working days (weekends and holidays are excluded).");
    }
    const days = new Prisma.Decimal(dayCount);

    // 4. Employment type, sex, yearly allowance and credits. The allowance year is the year the leave starts.
    await validateEligibility(tx, employee, type, days, yearOf(startDate));

    // 5. Details of leave, commutation.
    const details = cleanDetails(type.detailKind, input.details ?? {});
    if (input.commutation !== "NOT_REQUESTED" && input.commutation !== "REQUESTED") {
      throw new LeaveError("Please choose whether commutation is requested.");
    }
    // Panel revision 4: only convertible types (VL, SL) can have commutation (cash conversion) requested.
    if (input.commutation === "REQUESTED" && !type.convertible) {
      throw new LeaveError(`${type.name} is non-convertible, so commutation cannot be requested.`);
    }

    // 6. No overlap with the employee's own open or approved leave.
    const clash = await tx.leaveApplication.findFirst({
      where: {
        employeeId: employee.id,
        status: { in: [...OPEN_STATUSES, "APPROVED"] },
        startDate: { lte: toDbDate(endDate) },
        endDate: { gte: toDbDate(startDate) },
      },
    });
    if (clash) {
      throw new LeaveError(
        `These dates overlap with ${onBehalf ? "the employee's" : "your"} application ${clash.refNo} (${fromDbDate(clash.startDate)} to ${fromDbDate(clash.endDate)}).`,
      );
    }

    // 7. Routing: a department head has no one above him in the office, so his leave skips recommendation.
    const selfHead = employee.office.headId === employee.id;
    const status = selfHead ? "FOR_CERTIFICATION" : "FOR_RECOMMENDATION";
    const remarks = [
      onBehalf ? `Filed by ${fullName(actor)} (HRMO) on behalf of the employee.` : "",
      selfHead ? (onBehalf ? "Applicant is the office head; routed directly to HRMO." : "Filed by department head; routed directly to HRMO.") : "",
    ]
      .filter(Boolean)
      .join(" ");

    // 8. Save the application with its FILED step.
    const app = await tx.leaveApplication.create({
      data: {
        refNo: await newRefNo(tx),
        employeeId: employee.id,
        filedById: actor.id,
        typeCode: type.code,
        details,
        startDate: toDbDate(startDate),
        endDate: toDbDate(endDate),
        days,
        commutation: input.commutation,
        status,
        actions: { create: { step: "FILED", actorId: actor.id, remarks, signature: actor.signature } },
      },
    });

    // 9. Notifications and audit trail (same texts as the prototype).
    const byLine = onBehalf ? ` It was filed on your behalf by ${fullName(actor)}.` : "";
    await notify(
      tx,
      [employee.id],
      "Application submitted",
      `Your ${type.name} (${days} day/s) was submitted and is now ${status === "FOR_RECOMMENDATION" ? "with your department head" : "with the HRMO"}.${byLine}`,
      app.id,
    );
    await notify(
      tx,
      await actorsFor(tx, app),
      "New leave application",
      `${fullName(employee)} filed ${type.name} for ${days} day(s). Awaiting your action.`,
      app.id,
    );
    await audit(
      tx,
      actor.id,
      "FILE_LEAVE",
      `${app.refNo} · ${type.name} · ${fullName(employee)}${onBehalf ? ` · filed on behalf by ${fullName(actor)}` : ""}`,
    );

    return app;
  });
}
