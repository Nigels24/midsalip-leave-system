// Self-check of the leave rules in src/server/leave against the seeded database.
//   npm run verify:engine
// Everything runs inside ONE transaction that is rolled back at the end,
// so the database is left exactly as it was. Needs the seed data (npm run db:seed).
import "dotenv/config";
import { Prisma, type Sex, type EmploymentStatus } from "../src/generated/prisma/client";
import { db } from "../src/lib/db";
import { toDbDate } from "../src/lib/dates";
import { countLeaveDays } from "../src/lib/leave-types";
import {
  actOn,
  balance,
  canAct,
  cancelApplication,
  fileLeave,
  getLeaveOptions,
  LeaveError,
  waitingForWhere,
  type FileLeaveInput,
} from "../src/server/leave";
import { OPEN_STATUSES } from "../src/lib/constants";

type Tx = Prisma.TransactionClient;

class Rollback extends Error {} // thrown on purpose to undo everything
let failures = 0;

function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${!ok && detail ? `  -> ${detail}` : ""}`);
  if (!ok) failures++;
}

/** Expects fn to be refused with a LeaveError whose message contains `includes`. */
async function rejects(name: string, fn: () => Promise<unknown>, includes: string) {
  try {
    await fn();
    check(name, false, "was not rejected");
  } catch (error) {
    if (!(error instanceof LeaveError)) throw error; // a real bug: stop the run
    check(name, error.message.includes(includes), `message was: ${error.message}`);
  }
}

const eq = (value: Prisma.Decimal | null | undefined, expected: number | string | Prisma.Decimal) =>
  value != null && value.equals(expected);

const VACATION = { location: "Within the Philippines", locationSpec: "Pagadian City" };
const input = (employeeId: string, typeCode: string, startDate: string, endDate: string, details: Record<string, unknown> = {}): FileLeaveInput => ({
  employeeId,
  typeCode,
  startDate,
  endDate,
  details,
  commutation: "NOT_REQUESTED",
});

async function scenarios(tx: Tx) {
  const user = (username: string) => tx.employee.findUniqueOrThrow({ where: { username }, include: { office: true } });
  const jpepito = await user("jpepito"); // employee, HRMO office (head: hrmo)
  const mdizon = await user("mdizon"); // employee, Treasurer's office (head: treasurer)
  const klumbay = await user("klumbay"); // employee, Accountant's office
  const treasurer = await user("treasurer"); // department head
  const hrmo = await user("hrmo");
  const mayor = await user("mayor"); // approver

  // Signatures for the signature-copy checks.
  for (const person of [jpepito, mdizon, treasurer, hrmo, mayor]) {
    await tx.employee.update({ where: { id: person.id }, data: { signature: `data:image/png;base64,VERIFY-${person.username}` } });
  }

  // Temporary employees (removed by the rollback).
  let n = 0;
  const temp = (sex: Sex, status: EmploymentStatus) =>
    tx.employee.create({
      data: {
        employeeNo: `VERIFY-${++n}`,
        firstName: "Temp",
        lastName: `Verify${n}`,
        sex,
        position: "Test",
        salaryGrade: 1,
        monthlySalary: "15000",
        officeId: "MEO",
        status,
        originalAppointment: toDbDate("2025-01-02"),
        role: "EMPLOYEE",
        username: `verify-temp-${n}`,
        passwordHash: "not-a-login",
      },
    });
  const cosFemale = await temp("FEMALE", "COS");
  const permMale = await temp("MALE", "PERMANENT");
  const permFemale = await temp("FEMALE", "PERMANENT");

  console.log("\na) Employee files 2 working days of VL");
  const appA = await fileLeave(tx, input(jpepito.id, "VL", "2026-12-01", "2026-12-02", VACATION), jpepito.id);
  check("days = 2", eq(appA.days, 2), String(appA.days));
  check("status = FOR_RECOMMENDATION", appA.status === "FOR_RECOMMENDATION", appA.status);
  check("filedById = the employee", appA.filedById === jpepito.id);
  const headNotified = await tx.notification.count({ where: { userId: jpepito.office.headId!, applicationId: appA.id } });
  check("office head is notified", headNotified === 1, `${headNotified} notifications`);
  const audited = await tx.auditLog.count({ where: { action: "FILE_LEAVE", detail: { contains: appA.refNo } } });
  check("FILE_LEAVE audit row written", audited === 1);

  console.log("\nb) Overlapping dates");
  await rejects("overlap is rejected", () => fileLeave(tx, input(jpepito.id, "VL", "2026-12-02", "2026-12-03", VACATION), jpepito.id), "overlap");

  console.log("\nc) More days than the available credits");
  await rejects(
    "VL beyond available credits is rejected",
    () => fileLeave(tx, input(jpepito.id, "VL", "2027-01-04", "2027-06-30", VACATION), jpepito.id),
    "Insufficient vacation leave credits",
  );

  console.log("\nd) Weekends and holidays");
  await rejects("weekend-only range is rejected", () => fileLeave(tx, input(jpepito.id, "VL", "2026-12-05", "2026-12-06", VACATION), jpepito.id), "no working days");
  // Fri Nov 27 to Tue Dec 1: Sat, Sun and Mon Nov 30 (Bonifacio Day) are not counted.
  const appD = await fileLeave(tx, input(mdizon.id, "VL", "2026-11-27", "2026-12-01", VACATION), mdizon.id);
  check("range over Bonifacio Day counts 2 days", eq(appD.days, 2), String(appD.days));

  console.log("\ne) Eligibility by employment type and sex");
  await rejects("COS employee cannot file VL", () => fileLeave(tx, input(cosFemale.id, "VL", "2026-12-01", "2026-12-01", VACATION), cosFemale.id), "Contract of Service");
  const appML = await fileLeave(tx, input(cosFemale.id, "ML", "2026-12-01", "2026-12-31"), cosFemale.id);
  check("female COS employee can file ML", appML.status === "FOR_RECOMMENDATION");
  await rejects("male employee cannot file ML", () => fileLeave(tx, input(permMale.id, "ML", "2026-12-01", "2026-12-31"), permMale.id), "female employees only");
  await rejects("female employee cannot file PL", () => fileLeave(tx, input(permFemale.id, "PL", "2026-12-01", "2026-12-03"), permFemale.id), "male employees only");

  console.log("\nf) Calendar days vs working days");
  check("ML Dec 1-31 counts 31 calendar days", countLeaveDays("ML", "2026-12-01", "2026-12-31", ["2026-12-08", "2026-12-25"]) === 31);
  check("SPL Mon-Fri with a holiday counts 4 working days", countLeaveDays("SPL", "2026-12-07", "2026-12-11", ["2026-12-08"]) === 4);
  check("filed ML application stores 31 days", eq(appML.days, 31), String(appML.days));

  console.log("\ng) Yearly allowance used up");
  await fileLeave(tx, input(permFemale.id, "SPL", "2026-12-14", "2026-12-16", VACATION), permFemale.id); // 3 of 3 days
  const options = await getLeaveOptions(tx, permFemale.id, 2026);
  const spl = options.find((o) => o.type.code === "SPL");
  check("SPL is marked not allowed", spl?.allowed === false);
  check("SPL has a reason", !!spl?.reason?.includes("already used"), spl?.reason ?? "no reason");
  check("SPL remaining days = 0", eq(spl?.remainingDays, 0));
  const vlOption = options.find((o) => o.type.code === "VL");
  check("VL with zero credits is not allowed", vlOption?.allowed === false && !!vlOption.reason?.includes("credits"), vlOption?.reason ?? "");
  await rejects("a 4th SPL day is rejected", () => fileLeave(tx, input(permFemale.id, "SPL", "2026-12-17", "2026-12-17", VACATION), permFemale.id), "already used");

  console.log("\nh) Full approval chain (mdizon's 2-day VL)");
  const vlBefore = await balance(tx, mdizon.id, "VL");
  const slBefore = await balance(tx, mdizon.id, "SL");
  const recommended = await actOn(tx, appD.id, treasurer.id, "APPROVE", "");
  check("head recommends -> FOR_CERTIFICATION", recommended.status === "FOR_CERTIFICATION", recommended.status);
  const certified = await actOn(tx, appD.id, hrmo.id, "APPROVE", "");
  check("HRMO certifies -> FOR_APPROVAL", certified.status === "FOR_APPROVAL", certified.status);
  check("cert snapshot: VL total", eq(certified.certVlTotal, vlBefore), `${certified.certVlTotal} vs ${vlBefore}`);
  check("cert snapshot: VL less = 2", eq(certified.certVlLess, 2));
  check("cert snapshot: VL balance = total - 2", eq(certified.certVlBalance, vlBefore.minus(2)));
  check("cert snapshot: SL total / less / balance", eq(certified.certSlTotal, slBefore) && eq(certified.certSlLess, 0) && eq(certified.certSlBalance, slBefore));
  check("cert snapshot: as-of date set", certified.certAsOf !== null);
  const approved = await actOn(tx, appD.id, mayor.id, "APPROVE", "");
  check("mayor approves -> APPROVED", approved.status === "APPROVED", approved.status);
  const deduction = await tx.ledgerEntry.findFirst({ where: { applicationId: appD.id } });
  check("ledger deduction of 2 VL exists", deduction?.kind === "VL" && eq(deduction.deducted, 2));
  check("ledger particulars like the prototype", deduction?.particulars === `Vacation Leave 2026-11-27 to 2026-12-01 (${appD.refNo})`, deduction?.particulars);
  check("VL balance dropped by 2", eq(await balance(tx, mdizon.id, "VL"), vlBefore.minus(2)));
  const actions = await tx.approvalAction.findMany({ where: { applicationId: appD.id }, include: { actor: true } });
  check("4 actions recorded (filed, recommended, certified, approved)", actions.length === 4, String(actions.length));
  check("each action carries the actor's signature", actions.every((a) => a.signature === `data:image/png;base64,VERIFY-${a.actor.username}`));
  await tx.employee.update({ where: { id: treasurer.id }, data: { signature: "data:image/png;base64,CHANGED" } });
  const rec = await tx.approvalAction.findFirst({ where: { applicationId: appD.id, step: "RECOMMENDED" } });
  check("changing a signature later does not alter the signed copy", rec?.signature === "data:image/png;base64,VERIFY-treasurer");

  console.log("\ni) Wrong actor, missing remarks, acting twice");
  await rejects("mayor cannot recommend", () => actOn(tx, appA.id, mayor.id, "APPROVE", ""), "not the assigned officer");
  await rejects("disapproval without remarks", () => actOn(tx, appA.id, hrmo.id, "DISAPPROVE", "   "), "reason for disapproval");
  await actOn(tx, appA.id, hrmo.id, "APPROVE", "", "FOR_RECOMMENDATION"); // hrmo heads jpepito's office
  await rejects("same step submitted twice", () => actOn(tx, appA.id, hrmo.id, "APPROVE", "", "FOR_RECOMMENDATION"), "already acted on");
  await rejects("acting on a closed application", () => actOn(tx, appD.id, mayor.id, "APPROVE", ""), "already closed");

  console.log("\nj) Cancel");
  await rejects("cannot cancel someone else's application", () => cancelApplication(tx, appA.id, mdizon.id), "Only your own");
  const cancelled = await cancelApplication(tx, appA.id, jpepito.id);
  check("own open application is cancelled", cancelled.status === "CANCELLED");
  const told = await tx.notification.count({ where: { userId: hrmo.id, applicationId: appA.id, title: "Application cancelled" } });
  check("waiting officer is notified", told === 1);
  await rejects("cannot cancel an approved application", () => cancelApplication(tx, appD.id, mdizon.id), "Only your own");

  console.log("\nk) HRMO files on behalf of an employee");
  const sick = { sickWhere: "Out Patient", illness: "Influenza" };
  const appK = await fileLeave(tx, input(klumbay.id, "SL", "2026-12-09", "2026-12-10", sick), hrmo.id);
  check("employeeId = the employee", appK.employeeId === klumbay.id);
  check("filedById = the HRMO", appK.filedById === hrmo.id);
  const filed = await tx.approvalAction.findFirst({ where: { applicationId: appK.id, step: "FILED" } });
  check("FILED remark says on behalf", !!filed?.remarks.includes("on behalf"), filed?.remarks);
  const auditK = await tx.auditLog.findFirst({ where: { action: "FILE_LEAVE", detail: { contains: appK.refNo } } });
  check("audit detail says on behalf", !!auditK?.detail.includes("on behalf"), auditK?.detail);
  await rejects("a department head cannot file for someone else", () => fileLeave(tx, input(klumbay.id, "SL", "2026-12-14", "2026-12-14", sick), treasurer.id), "Only the HRMO");

  console.log("\nl) Department head's own leave");
  const appL = await fileLeave(tx, input(treasurer.id, "VL", "2026-12-14", "2026-12-15", VACATION), treasurer.id);
  check("goes straight to FOR_CERTIFICATION", appL.status === "FOR_CERTIFICATION", appL.status);
  const filedL = await tx.approvalAction.findFirst({ where: { applicationId: appL.id, step: "FILED" } });
  check("FILED remark like the prototype", filedL?.remarks === "Filed by department head; routed directly to HRMO.", filedL?.remarks);

  console.log("\nm) Commutation only for convertible types");
  await rejects(
    "SPL with commutation requested is rejected",
    () => fileLeave(tx, { ...input(mdizon.id, "SPL", "2026-12-21", "2026-12-21", VACATION), commutation: "REQUESTED" }, mdizon.id),
    "non-convertible",
  );
  const appM = await fileLeave(tx, { ...input(mdizon.id, "VL", "2026-12-21", "2026-12-22", VACATION), commutation: "REQUESTED" }, mdizon.id);
  check("VL with commutation requested is accepted", appM.commutation === "REQUESTED");

  console.log("\nn) For My Action list matches canAct");
  const open = await tx.leaveApplication.findMany({ where: { status: { in: OPEN_STATUSES } } });
  for (const person of [treasurer, hrmo, mayor, jpepito]) {
    const listed = await tx.leaveApplication.findMany({ where: waitingForWhere(person), select: { id: true } });
    const expected: string[] = [];
    for (const app of open) if (await canAct(tx, app, person.id)) expected.push(app.id);
    const same = listed.length === expected.length && listed.every((a) => expected.includes(a.id));
    check(`${person.username}: ${listed.length} waiting, same as canAct`, same, `list ${listed.length}, canAct ${expected.length}`);
  }
}

async function main() {
  try {
    // Long timeout: the default (5 s) is too short for all scenarios in one transaction.
    await db.$transaction(
      async (tx) => {
        await scenarios(tx);
        throw new Rollback(); // undo everything the scenarios wrote
      },
      { timeout: 60_000, maxWait: 10_000 },
    );
  } catch (error) {
    if (!(error instanceof Rollback)) {
      check("scenarios ran without an unexpected error", false, error instanceof Error ? error.message : String(error));
    }
  }

  // The rollback must have removed every trace.
  const leftovers = await db.employee.count({ where: { employeeNo: { startsWith: "VERIFY-" } } });
  console.log("");
  check("database unchanged after rollback", leftovers === 0);

  console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) FAILED.`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main().finally(() => db.$disconnect());
