// Approval routing, same as the prototype:
//   FOR_RECOMMENDATION -> head of the applicant's office
//   FOR_CERTIFICATION  -> any active HRMO (certifies the leave credits, CS Form 6 item 7.A)
//   FOR_APPROVAL       -> any active APPROVER (the Municipal Mayor)
import type { ActionStep, ApplicationStatus } from "../../generated/prisma/client";
import { isOpen } from "../../lib/constants";
import { toDbDate, todayInManila } from "../../lib/dates";
import { fullName } from "../../lib/utils";
import { balance, ZERO } from "./credits";
import { LeaveError } from "./errors";
import { audit, inTransaction, notify, type DbClient } from "./shared";

export type Decision = "APPROVE" | "DISAPPROVE";

type Routable = { status: ApplicationStatus; employeeId: string };

/** Ids of the employees who must act on the application next. */
export async function actorsFor(client: DbClient, application: Routable): Promise<string[]> {
  switch (application.status) {
    case "FOR_RECOMMENDATION": {
      const applicant = await client.employee.findUnique({
        where: { id: application.employeeId },
        select: { office: { select: { headId: true } } },
      });
      const headId = applicant?.office.headId;
      return headId ? [headId] : [];
    }
    case "FOR_CERTIFICATION":
      return idsWithRole(client, "HRMO");
    case "FOR_APPROVAL":
      return idsWithRole(client, "APPROVER");
    default:
      return []; // closed: nobody acts any more
  }
}

async function idsWithRole(client: DbClient, role: "HRMO" | "APPROVER") {
  const people = await client.employee.findMany({ where: { role, active: true }, select: { id: true } });
  return people.map((p) => p.id);
}

/** Is this person an assigned officer for the application's current step? */
export async function canAct(client: DbClient, application: Routable, actorId: string) {
  return (await actorsFor(client, application)).includes(actorId);
}

// Used in the applicant's notification: "Your Vacation Leave (...) was certified by the HRMO by ..."
const STEP_TEXT: Record<ActionStep, string> = {
  FILED: "filed",
  RECOMMENDED: "recommended for approval",
  NOT_RECOMMENDED: "not recommended",
  CERTIFIED: "certified by the HRMO",
  APPROVED: "APPROVED",
  DISAPPROVED: "disapproved",
  CANCELLED: "cancelled",
};

const ALREADY_ACTED = "This application was already acted on by someone else. Please refresh the page.";

/**
 * Recommend / certify / approve (or disapprove) the current step.
 * expectedStatus: the status the officer saw on screen. If it changed in the meantime
 * (double click, second browser tab), the action is refused instead of acting twice.
 */
export async function actOn(
  client: DbClient,
  applicationId: string,
  actorId: string,
  decision: Decision,
  remarks: string,
  expectedStatus?: ApplicationStatus,
) {
  return inTransaction(client, async (tx) => {
    const app = await tx.leaveApplication.findUnique({
      where: { id: applicationId },
      include: { employee: true, leaveType: true },
    });
    if (!app) throw new LeaveError("Application not found.");
    if (expectedStatus && app.status !== expectedStatus) throw new LeaveError(ALREADY_ACTED);
    if (!isOpen(app.status)) throw new LeaveError("This application is already closed.");

    const actor = await tx.employee.findUnique({ where: { id: actorId } });
    if (!actor || !actor.active || !(await canAct(tx, app, actorId))) {
      throw new LeaveError("You are not the assigned officer for this step.");
    }
    const note = remarks.trim();
    if (decision === "DISAPPROVE" && !note) throw new LeaveError("Please state the reason for disapproval.");

    const approve = decision === "APPROVE";
    const type = app.leaveType;
    const today = todayInManila();
    let step: ActionStep;
    let next: ApplicationStatus;
    let certification = {};

    switch (app.status) {
      case "FOR_RECOMMENDATION":
        step = approve ? "RECOMMENDED" : "NOT_RECOMMENDED";
        next = approve ? "FOR_CERTIFICATION" : "DISAPPROVED";
        break;
      case "FOR_CERTIFICATION": {
        if (approve) {
          // The HRMO certifies the leave credits as of today (CS Form 6, item 7.A).
          const vlTotal = await balance(tx, app.employeeId, "VL", today);
          const slTotal = await balance(tx, app.employeeId, "SL", today);
          const vlLess = type.deductsFrom === "VL" ? app.days : ZERO;
          const slLess = type.deductsFrom === "SL" ? app.days : ZERO;
          if (vlLess.gt(vlTotal) || slLess.gt(slTotal)) {
            throw new LeaveError("Cannot certify: the employee's current balance is lower than the days applied for.");
          }
          // A snapshot, so the printed form keeps showing these figures even after the balance changes.
          certification = {
            certAsOf: toDbDate(today),
            certVlTotal: vlTotal,
            certSlTotal: slTotal,
            certVlLess: vlLess,
            certSlLess: slLess,
            certVlBalance: vlTotal.minus(vlLess),
            certSlBalance: slTotal.minus(slLess),
          };
        }
        step = approve ? "CERTIFIED" : "DISAPPROVED";
        next = approve ? "FOR_APPROVAL" : "DISAPPROVED";
        break;
      }
      default: // FOR_APPROVAL
        step = approve ? "APPROVED" : "DISAPPROVED";
        next = approve ? "APPROVED" : "DISAPPROVED";
    }

    // Move on only if the status is still the one we read. If another officer acted a moment
    // ago, PostgreSQL makes this update wait for them and then it matches 0 rows.
    const { count } = await tx.leaveApplication.updateMany({
      where: { id: app.id, status: app.status },
      data: { status: next, ...certification },
    });
    if (count !== 1) throw new LeaveError(ALREADY_ACTED);

    // Panel revision 5: copy the signature now, so a later change never alters a signed form.
    await tx.approvalAction.create({
      data: { applicationId: app.id, step, actorId, remarks: note, signature: actor.signature },
    });

    // Only final approval touches the leave card.
    if (next === "APPROVED" && type.deductsFrom) {
      const range = app.endDate.getTime() !== app.startDate.getTime() ? ` to ${iso(app.endDate)}` : "";
      await tx.ledgerEntry.create({
        data: {
          employeeId: app.employeeId,
          date: toDbDate(today),
          particulars: `${type.name} ${iso(app.startDate)}${range} (${app.refNo})`,
          kind: type.deductsFrom,
          deducted: app.days,
          applicationId: app.id,
        },
      });
    }

    const applicantName = fullName(app.employee);
    const title = next === "APPROVED" ? "Leave approved" : next === "DISAPPROVED" ? "Leave disapproved" : "Application update";
    await notify(
      tx,
      [app.employeeId],
      title,
      `Your ${type.name} (${app.refNo}) was ${STEP_TEXT[step]} by ${fullName(actor)}.` +
        (note ? ` Remarks: ${note}` : "") +
        (next === "APPROVED" ? " You may now print CS Form No. 6 with its QR code." : ""),
      app.id,
    );
    if (isOpen(next)) {
      await notify(
        tx,
        await actorsFor(tx, { status: next, employeeId: app.employeeId }),
        "Leave application awaiting action",
        `${applicantName} – ${type.name} (${app.days} day/s) was ${STEP_TEXT[step]} and now needs your action.`,
        app.id,
      );
    }
    await audit(tx, actorId, step, `${app.refNo} · ${applicantName}${note ? ` · ${note}` : ""}`);

    return tx.leaveApplication.findUniqueOrThrow({ where: { id: app.id } });
  });
}

/** The applicant withdraws an application that nobody has finished yet. */
export async function cancelApplication(client: DbClient, applicationId: string, actorId: string) {
  return inTransaction(client, async (tx) => {
    const app = await tx.leaveApplication.findUnique({ where: { id: applicationId }, include: { employee: true } });
    if (!app || app.employeeId !== actorId || !isOpen(app.status)) {
      throw new LeaveError("Only your own pending applications can be cancelled.");
    }
    const waitingOfficers = await actorsFor(tx, app); // read before the status changes

    const { count } = await tx.leaveApplication.updateMany({
      where: { id: app.id, status: app.status },
      data: { status: "CANCELLED" },
    });
    if (count !== 1) throw new LeaveError(ALREADY_ACTED);

    await tx.approvalAction.create({
      data: { applicationId: app.id, step: "CANCELLED", actorId, remarks: "Cancelled by applicant", signature: app.employee.signature },
    });
    await notify(tx, waitingOfficers, "Application cancelled", `${fullName(app.employee)} cancelled ${app.refNo}.`, app.id);
    await audit(tx, actorId, "CANCEL", app.refNo);

    return tx.leaveApplication.findUniqueOrThrow({ where: { id: app.id } });
  });
}

/** Date from a @db.Date column -> "YYYY-MM-DD". */
const iso = (date: Date) => date.toISOString().slice(0, 10);
