// Self-check of the leave rules in src/server/leave against the seeded database.
//   npm run verify:engine
// Everything runs inside ONE transaction that is rolled back at the end,
// so the database is left exactly as it was. Needs the seed data (npm run db:seed).
import "dotenv/config";
import { Prisma, type Sex, type EmploymentStatus } from "../src/generated/prisma/client";
import { db } from "../src/lib/db";
import { fromDbDate, toDbDate, todayInManila } from "../src/lib/dates";
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
  accrualPreview,
  postAccrual,
  loadHolidays,
} from "../src/server/leave";
import { addHoliday, deleteHoliday, updateHoliday } from "../src/server/holiday-rules";
import { createOffice, officeSchema, updateOffice } from "../src/server/office-rules";
import { createEmployee, newEmployeeSchema, setEmployeeActive, setOfficeHead } from "../src/server/employee-rules";
import { OPEN_STATUSES } from "../src/lib/constants";
import { checkSignatureDataUrl } from "../src/lib/signature";
import { leaveOnDay, monthGrid, parseMonth, shiftMonth } from "../src/lib/calendar";
import { leaveCardRows } from "../src/lib/leave-card";
import { BOM, csvCell, toCsv } from "../src/lib/csv";
import { monthlyTotals, safeAuditDetail, sumDecimals } from "../src/lib/report-math";
import { normalizeRefNo, publicVerifyResult, verifyUrl, type VerifyRecord } from "../src/lib/verify";

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

  console.log("\nr) Monthly credit posting and account safety rules");
  const today = todayInManila();
  const month = shiftMonth(today.slice(0, 7), -1); // last month: never in the future
  const lateHire = await temp("FEMALE", "PERMANENT");
  await tx.employee.update({ where: { id: lateHire.id }, data: { originalAppointment: toDbDate(today) } }); // hired after that month
  const bal = async (id: string) => [await balance(tx, id, "VL"), await balance(tx, id, "SL")] as const;
  const [permVL, permSL] = await bal(permMale.id);
  const [cosVL, cosSL] = await bal(cosFemale.id);

  const preview = await accrualPreview(tx, month, today);
  check("preview lists credit earners only", preview.toPost.some((e) => e.id === permMale.id) && !preview.toPost.some((e) => e.id === cosFemale.id));
  check("preview skips someone appointed after the month", !preview.toPost.some((e) => e.id === lateHire.id));

  const posted = await postAccrual(tx, month, hrmo.id, today);
  const [permVL2, permSL2] = await bal(permMale.id);
  check(`posted ${posted.employees} employees, 2 entries each`, posted.entries === posted.employees * 2, `${posted.entries} entries`);
  check("permanent employee: VL = before + 1.25", permVL2.equals(permVL.plus("1.25")), `${permVL} -> ${permVL2}`);
  check("permanent employee: SL = before + 1.25", permSL2.equals(permSL.plus("1.25")), `${permSL} -> ${permSL2}`);
  const [cosVL2, cosSL2] = await bal(cosFemale.id);
  check("COS employee gets nothing", cosVL2.equals(cosVL) && cosSL2.equals(cosSL));
  check("late hire gets nothing", (await bal(lateHire.id)).every((b) => b.isZero()));

  const entriesBefore = await tx.ledgerEntry.count({ where: { accrualMonth: month } });
  await rejects("posting the same month again is refused", () => postAccrual(tx, month, hrmo.id, today), "Nothing to post");
  check("posting again added no ledger entries", (await tx.ledgerEntry.count({ where: { accrualMonth: month } })) === entriesBefore);
  check("balance unchanged after the second attempt", (await balance(tx, permMale.id, "VL")).equals(permVL2));
  await rejects("a future month is refused", () => postAccrual(tx, shiftMonth(today.slice(0, 7), 1), hrmo.id, today), "future month");

  await rejects("the last active HRMO cannot be deactivated", () => setEmployeeActive(tx, hrmo.id, false, mayor.id), "only active HRMO");
  await rejects("the last active Approving Authority cannot be deactivated", () => setEmployeeActive(tx, mayor.id, false, hrmo.id), "only active Approving Authority");
  await rejects("the HRMO cannot deactivate themselves", () => setEmployeeActive(tx, hrmo.id, false, hrmo.id), "your own account");
  await rejects("an office head cannot be deactivated", () => setEmployeeActive(tx, treasurer.id, false, hrmo.id), "Set another head");
  const permFemaleOpen = await tx.leaveApplication.count({ where: { employeeId: permFemale.id, status: { in: OPEN_STATUSES } } });
  if (permFemaleOpen > 0) {
    await rejects("an employee with open applications cannot be deactivated", () => setEmployeeActive(tx, permFemale.id, false, hrmo.id), "open application");
  }
  await rejects("a head must belong to the office", () => setOfficeHead(tx, "MEO", jpepito.id, hrmo.id), "does not belong");
  const duplicate = newEmployeeSchema.parse({
    employeeNo: "VERIFY-DUP",
    firstName: "Dup",
    middleInitial: "",
    lastName: "Licate",
    sex: "MALE",
    position: "Test",
    salaryGrade: "1",
    monthlySalary: "",
    officeId: "MEO",
    status: "PERMANENT",
    role: "EMPLOYEE",
    originalAppointment: "2025-01-02",
    username: " JPepito ", // normalized to "jpepito", which exists
    password: "temporary-123",
    openingVL: "",
    openingSL: "",
  });
  await rejects("a duplicate username is refused (any case)", () => createEmployee(tx, duplicate, hrmo.id), "already taken");

  console.log("\nt) Office without a head (fresh install)");
  await tx.office.create({ data: { id: "VRFY", name: "Verify Office" } }); // no head
  const headless = await temp("FEMALE", "PERMANENT");
  await tx.employee.update({ where: { id: headless.id }, data: { officeId: "VRFY" } });
  // Enough VL credits, so a refusal can only come from the missing head (not from the balance).
  await tx.ledgerEntry.create({
    data: { employeeId: headless.id, kind: "VL", date: toDbDate("2026-01-01"), particulars: "Verify opening balance", earned: new Prisma.Decimal(10) },
  });
  const headlessVL = await balance(tx, headless.id, "VL");
  check("headless-office employee has VL credits", headlessVL.greaterThanOrEqualTo(1), headlessVL.toString());
  const headlessInput = input(headless.id, "VL", "2026-12-21", "2026-12-21", VACATION);
  await rejects("filing is refused until the office has a head", () => fileLeave(tx, headlessInput, headless.id), "no department head");

  // Once the HRMO sets a head, the same filing goes through to that head for recommendation.
  const newHead = await temp("MALE", "PERMANENT");
  await tx.employee.update({ where: { id: newHead.id }, data: { officeId: "VRFY" } });
  await setOfficeHead(tx, "VRFY", newHead.id, hrmo.id);
  const appT = await fileLeave(tx, headlessInput, headless.id);
  check("after a head is set, the same filing succeeds", appT.status === "FOR_RECOMMENDATION", appT.status);
  check("the new head is the one to act", await canAct(tx, appT, newHead.id));

  console.log("\nu) Holidays and offices (HRMO screens)");
  // Mon Mar 1 to Fri Mar 5, 2027 (a week the demo data has no holiday in).
  const weekDays = async () => countLeaveDays("VL", "2027-03-01", "2027-03-05", await loadHolidays(tx, "2027-03-01", "2027-03-05"));
  const daysBefore = await weekDays();
  await addHoliday(tx, { date: "2027-03-03", name: "Verify Holiday" }, hrmo.id);
  check("adding a holiday removes it from the working-day count", (await weekDays()) === daysBefore - 1, `${daysBefore} -> ${await weekDays()}`);
  await rejects("a second holiday on the same date is refused", () => addHoliday(tx, { date: "2027-03-03", name: "Another" }, hrmo.id), "already a holiday");
  await updateHoliday(tx, "2027-03-03", { date: "2027-03-04", name: "Verify Holiday (moved)" }, hrmo.id);
  const moved = await tx.holiday.findUnique({ where: { date: toDbDate("2027-03-04") } });
  check("editing a holiday can move its date", moved?.name === "Verify Holiday (moved)" && !(await tx.holiday.findUnique({ where: { date: toDbDate("2027-03-03") } })));
  await deleteHoliday(tx, "2027-03-04", hrmo.id);
  check("deleting a holiday restores the count", (await weekDays()) === daysBefore);
  const holidayAudits = await tx.auditLog.count({ where: { action: { in: ["ADD_HOLIDAY", "UPDATE_HOLIDAY", "DELETE_HOLIDAY"] }, detail: { contains: "Verify Holiday" } } });
  check("each holiday change writes an audit row", holidayAudits === 3, `${holidayAudits} rows`);

  const mto = await tx.office.findUniqueOrThrow({ where: { id: "MTO" } });
  await rejects("a duplicate office code is refused (any case)", () => createOffice(tx, officeSchema.parse({ code: "mto", name: "Some New Office" }), hrmo.id), "already used");
  await rejects(
    "a duplicate office name is refused (any case)",
    () => createOffice(tx, officeSchema.parse({ code: "NEW1", name: mto.name.toUpperCase() }), hrmo.id),
    "already an office named",
  );
  await createOffice(tx, officeSchema.parse({ code: "new1", name: "Verify New Office" }), hrmo.id);
  const created = await tx.office.findUnique({ where: { id: "NEW1" } });
  check("a new office is stored with a capital code and no head", created?.name === "Verify New Office" && created.headId === null);
  await rejects("renaming to another office's code is refused", () => updateOffice(tx, "NEW1", officeSchema.parse({ code: "Mto", name: "Verify New Office" }), hrmo.id), "already used");

  // Rename the office of scenario t (head: newHead, employees: headless and newHead).
  const staffBefore = await tx.employee.count({ where: { officeId: "VRFY" } });
  await updateOffice(tx, "VRFY", officeSchema.parse({ code: "vrfy-2", name: "Verify Office Renamed" }), hrmo.id);
  const renamed = await tx.office.findUnique({ where: { id: "VRFY-2" }, include: { employees: { select: { id: true } } } });
  check("renaming an office keeps its head", renamed?.headId === newHead.id, renamed?.headId ?? "not found");
  check("renaming an office keeps its employees", renamed?.employees.length === staffBefore && staffBefore === 2, `${renamed?.employees.length} of ${staffBefore}`);
  check("the old code is gone", !(await tx.office.findUnique({ where: { id: "VRFY" } })));
  check("its waiting leave still goes to the same head", await canAct(tx, appT, newHead.id));
  await updateOffice(tx, "VRFY-2", officeSchema.parse({ code: "VRFY-2", name: "verify office renamed" }), hrmo.id);
  check("an office may change only the letter case of its own name", (await tx.office.findUnique({ where: { id: "VRFY-2" } }))?.name === "verify office renamed");
}

/** o) The e-signature validator (pure function, no database). */
function signatureChecks() {
  console.log("\no) E-signature validator");
  const tinyPng = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
  check("a small PNG is accepted", checkSignatureDataUrl(tinyPng) === null);
  check("a JPEG is accepted", checkSignatureDataUrl("data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD") === null);
  check("SVG is rejected", checkSignatureDataUrl("data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=") !== null);
  check("PNG label with non-PNG content is rejected", checkSignatureDataUrl("data:image/png;base64,/9j/4AAQSkZJRg==") !== null);
  check("not a data URL is rejected", checkSignatureDataUrl("https://example.com/sig.png") !== null);
  check("over 200 KB is rejected", checkSignatureDataUrl(`data:image/png;base64,iVBORw0KGgo${"A".repeat(300_000)}`) !== null);
}

/** p) Public QR verification: the URL in the QR code and what the public page may show (pure, no database). */
function verifyChecks() {
  console.log("\np) Public QR verification");
  check("reference number normalized", normalizeRefNo(" mmh-2026-k7qx -3mpa ") === "MMH-2026-K7QX-3MPA");
  check(
    "QR URL uses the request host (LAN address)",
    verifyUrl("mmh-2026-k7qx-3mpa", { host: "192.168.1.10:3000" }) === "http://192.168.1.10:3000/verify/MMH-2026-K7QX-3MPA",
  );
  check(
    "QR URL uses https behind a proxy",
    verifyUrl("MMH-2026-K7QX-3MPA", { host: "mmh.example.org", proto: "https" }) === "https://mmh.example.org/verify/MMH-2026-K7QX-3MPA",
  );
  check(
    "APP_URL overrides the request host",
    verifyUrl("MMH-2026-K7QX-3MPA", { appUrl: "https://leave.midsalip.gov.ph/", host: "localhost:3000" }) ===
      "https://leave.midsalip.gov.ph/verify/MMH-2026-K7QX-3MPA",
  );

  const record: VerifyRecord = {
    refNo: "MMH-2026-K7QX-3MPA",
    status: "APPROVED",
    employeeName: "Juan P. Pepito",
    officeName: "Human Resource Management Office",
    leaveTypeName: "Vacation Leave",
    dates: "Dec 1, 2026 – Dec 3, 2026",
    days: "3",
    approvedAt: "Nov 7, 2026, 9:15 AM",
    officers: [
      { step: "FILED", name: "Juan P. Pepito", position: "Admin Aide" },
      { step: "RECOMMENDED", name: "Head", position: "MGDH I" },
      { step: "CERTIFIED", name: "HRMO", position: "HRMO II" },
      { step: "APPROVED", name: "Mayor", position: "Municipal Mayor" },
    ],
  };
  const approved = publicVerifyResult(record.refNo, record);
  check("approved -> AUTHENTIC with the details", approved.kind === "AUTHENTIC" && approved.employeeName === "Juan P. Pepito");
  check(
    "approved -> only the recommending, certifying and approving officers",
    approved.kind === "AUTHENTIC" && approved.officers.map((o) => o.label).join("|") === "Recommended by|Certified by|Approved by",
  );

  for (const status of ["FOR_APPROVAL", "DISAPPROVED", "CANCELLED"] as const) {
    const result = publicVerifyResult(record.refNo, { ...record, status });
    const keys = Object.keys(result).sort().join(",");
    check(`${status} -> status only, no personal details`, result.kind === "NOT_APPROVED" && keys === "kind,refNo,status", `keys: ${keys}`);
  }
  check("unknown reference -> NOT_FOUND", publicVerifyResult("MMH-0000-AAAA-AAAA", null).kind === "NOT_FOUND");
}

/** q) Leave card running balance and the calendar month grid (pure), plus the card against balance(). */
async function cardAndCalendarChecks() {
  console.log("\nq) Leave card and calendar helpers");
  const d = (n: number | string) => new Prisma.Decimal(n);
  const rows = leaveCardRows([
    { date: "2026-02-28", particulars: "Earned – February 2026", kind: "SL", earned: d("1.25"), deducted: d(0) },
    { date: "2026-01-31", particulars: "Earned – January 2026", kind: "VL", earned: d("1.25"), deducted: d(0) },
    { date: "2026-01-31", particulars: "Earned – January 2026", kind: "SL", earned: d("1.25"), deducted: d(0) },
    { date: "2026-02-28", particulars: "Earned – February 2026", kind: "VL", earned: d("1.25"), deducted: d(0) },
    { date: "2026-03-05", particulars: "Vacation Leave (MMH-2026-AAAA-AAAA)", kind: "VL", earned: d(0), deducted: d("0.5") },
  ]);
  check("VL and SL of the same transaction share one row", rows.length === 3, `${rows.length} rows`);
  check("rows in date order", rows.map((r) => r.date).join(",") === "2026-01-31,2026-02-28,2026-03-05");
  check("running VL balance exact (1.25 + 1.25 - 0.5 = 2)", rows[2].vlBalance.equals(2) && rows[1].vlBalance.equals("2.5"));
  check("running SL balance carried to the last row", rows[2].slBalance.equals("2.5"));

  check("Feb 2026 grid is exactly 4 weeks (starts on a Sunday)", monthGrid("2026-02").length === 28 && monthGrid("2026-02")[0].iso === "2026-02-01");
  const nov = monthGrid("2026-11");
  check("Nov 2026 grid runs Sun Nov 1 to Sat Dec 5", nov[0].iso === "2026-11-01" && nov.at(-1)?.iso === "2026-12-05" && !nov.at(-1)!.inMonth);
  const may = monthGrid("2026-05");
  check("May 2026 grid starts on Sunday Apr 26", may[0].iso === "2026-04-26" && may.length === 42);
  check("month navigation crosses the year", shiftMonth("2026-01", -1) === "2025-12" && shiftMonth("2026-12", 1) === "2027-01");
  check("bad ?month falls back to this month", parseMonth("2026-13", "2026-11-07") === "2026-11" && parseMonth("2026-03", "2026-11-07") === "2026-03");

  const leave = [
    { startDate: "2026-11-06", endDate: "2026-11-09", typeCode: "VL" },
    { startDate: "2026-11-06", endDate: "2026-11-09", typeCode: "ML" },
  ];
  const sat = nov.find((x) => x.iso === "2026-11-07")!;
  const mon = nov.find((x) => x.iso === "2026-11-09")!;
  check("weekend: only calendar-day leave (ML) shows", leaveOnDay(leave, sat, new Set()).map((a) => a.typeCode).join() === "ML");
  check("working day: both show", leaveOnDay(leave, mon, new Set()).length === 2);
  check("holiday: only calendar-day leave shows", leaveOnDay(leave, mon, new Set(["2026-11-09"])).length === 1);

  // The leave card's last row must equal balance() for every seeded employee (read only).
  const employees = await db.employee.findMany({ select: { id: true } });
  let mismatches = 0;
  for (const e of employees) {
    const entries = await db.ledgerEntry.findMany({ where: { employeeId: e.id }, orderBy: [{ date: "asc" }, { createdAt: "asc" }] });
    const last = leaveCardRows(entries.map((x) => ({ ...x, date: fromDbDate(x.date) }))).at(-1);
    const [vl, sl] = [await balance(db, e.id, "VL"), await balance(db, e.id, "SL")];
    if (!(last ? last.vlBalance.equals(vl) && last.slBalance.equals(sl) : vl.isZero() && sl.isZero())) mismatches++;
  }
  check(`leave card final balance equals balance() for all ${employees.length} employees`, mismatches === 0, `${mismatches} differ`);
}

/** s) Reports: CSV escaping, Decimal totals, monthly trend, audit detail clean-up (pure, no database). */
function reportChecks() {
  console.log("\ns) Reports and CSV");
  check("plain cell unchanged", csvCell("Vacation Leave") === "Vacation Leave");
  check("comma -> quoted", csvCell("Dizon, Mark") === '"Dizon, Mark"');
  check('quote -> doubled and quoted', csvCell('the "Mayor"') === '"the ""Mayor"""');
  check("newline -> quoted", csvCell("line 1\nline 2") === '"line 1\nline 2"');
  check("formula is neutralized", csvCell("=SUM(A1:A9)") === "'=SUM(A1:A9)");
  check("negative number stays a number", csvCell("-1.250") === "-1.250");
  const file = toCsv([["Employee", "Days"], ["Peñaflor, Ana", "2.500"]]);
  check("file starts with the UTF-8 BOM", file.startsWith(BOM) && BOM === "\uFEFF");
  check("rows end with CRLF", file === `${BOM}Employee,Days\r\n"Peñaflor, Ana",2.500\r\n`);

  const d = (n: string) => new Prisma.Decimal(n);
  check("Decimal total is exact (0.1 + 0.2 = 0.3)", sumDecimals([d("0.1"), d("0.2")]).equals("0.3"));
  const months = monthlyTotals(
    [
      { startDate: "2026-03-30", days: d("3") }, // runs into April but counts in March (start month)
      { startDate: "2026-03-02", days: d("0.5") },
      { startDate: "2026-11-09", days: d("2") },
      { startDate: "2025-12-31", days: d("9") }, // another year: ignored
    ],
    2026,
  );
  check("12 months, January first", months.length === 12 && months[0].month === "2026-01");
  check("March: 2 applications, 3.5 days", months[2].count === 2 && months[2].days.equals("3.5"));
  check("other years are ignored", sumDecimals(months.map((m) => m.days)).equals("5.5"));

  check(
    "audit detail hides a bcrypt hash",
    // A bcrypt hash is 60 characters: "$2b$10$" plus 53 more.
    safeAuditDetail(`x $2b$10$${"N9qo8uLOickgx2ZMRZoMye".padEnd(53, "A")} y`) === "x [hidden] y",
  );
  check("audit detail hides a signature data URL", safeAuditDetail("sig data:image/png;base64,iVBORw0KGgo= end") === "sig [image] end");
}

async function main() {
  signatureChecks();
  verifyChecks();
  await cardAndCalendarChecks();
  reportChecks();
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
