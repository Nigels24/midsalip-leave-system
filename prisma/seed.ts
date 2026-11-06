// Seed: loads reference data and demo accounts (same as the prototype).
// Safe to run many times: every write is an upsert or is skipped if it already exists.
//   npm run db:seed
import "dotenv/config";
import bcrypt from "bcryptjs";
import { format } from "date-fns";
import { Prisma, type EmploymentStatus, type Role, type Sex } from "../src/generated/prisma/client";
import { db } from "../src/lib/db";
import { MONTHLY_ACCRUAL } from "../src/lib/constants";
import { CREDIT_EARNING_STATUSES, LEAVE_TYPES } from "../src/lib/leave-types";
import { toDbDate } from "../src/lib/dates";
import { normalizeUsername } from "../src/lib/utils";

const DEMO_PASSWORD = "demo123";
const OPENING_DATE = "2025-12-31";
const OPENING_PARTICULARS = "Balance forwarded (leave card)";
const ACCRUAL_MONTHS = ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08"];

// ── Offices: [id, name, head username] ───────────────────────
const OFFICES: [id: string, name: string, headUsername: string][] = [
  ["MO", "Office of the Municipal Mayor", "mayor"],
  ["HRMO", "Human Resource Management Office", "hrmo"],
  ["MTO", "Office of the Municipal Treasurer", "treasurer"],
  ["MACCO", "Office of the Municipal Accountant", "accountant"],
  ["MEO", "Office of the Municipal Engineer", "engineer"],
  ["MSWDO", "Municipal Social Welfare and Development Office", "mswdo"],
  ["MHO", "Municipal Health Office", "mho"],
];

// ── Employees ────────────────────────────────────────────────
// Money and credit values are strings so they go into Decimal columns exactly.
type EmployeeRow = [
  employeeNo: string,
  firstName: string,
  middleInitial: string,
  lastName: string,
  sex: Sex,
  position: string,
  salaryGrade: number,
  monthlySalary: string,
  officeId: string,
  status: EmploymentStatus,
  originalAppointment: string,
  role: Role,
  username: string,
  openingVL: string,
  openingSL: string,
];

const EMPLOYEES: EmployeeRow[] = [
  ["2019-001", "Ramon", "T", "Villarosa", "MALE", "Municipal Mayor", 27, "110000", "MO", "ELECTIVE", "2019-06-30", "APPROVER", "mayor", "0", "0"],
  ["2008-014", "Liza", "M", "Dalisay", "FEMALE", "MGDH I (HRMO)", 24, "85000", "HRMO", "PERMANENT", "2008-03-01", "HRMO", "hrmo", "112.5", "140.25"],
  ["2010-006", "Eduardo", "P", "Salcedo", "MALE", "Municipal Treasurer", 24, "85000", "MTO", "PERMANENT", "2010-07-15", "DEPT_HEAD", "treasurer", "98", "120.5"],
  ["2012-021", "Grace", "L", "Manalo", "FEMALE", "Municipal Accountant", 24, "85000", "MACCO", "PERMANENT", "2012-01-03", "DEPT_HEAD", "accountant", "76.75", "88"],
  ["2011-009", "Nestor", "B", "Alcantara", "MALE", "Municipal Engineer", 24, "85000", "MEO", "PERMANENT", "2011-09-01", "DEPT_HEAD", "engineer", "64.5", "95.25"],
  ["2014-017", "Teresita", "C", "Robles", "FEMALE", "MSWD Officer", 24, "85000", "MSWDO", "PERMANENT", "2014-02-17", "DEPT_HEAD", "mswdo", "58", "71.5"],
  ["2013-003", "Arnel", "D", "Fuentes", "MALE", "Municipal Health Officer", 24, "85000", "MHO", "PERMANENT", "2013-05-20", "DEPT_HEAD", "mho", "45.25", "60"],
  ["2018-030", "Joanna", "R", "Pepito", "FEMALE", "Administrative Officer II", 11, "30000", "HRMO", "PERMANENT", "2018-08-01", "EMPLOYEE", "jpepito", "34.5", "41.75"],
  ["2020-044", "Mark", "A", "Dizon", "MALE", "Revenue Collection Clerk I", 5, "19000", "MTO", "PERMANENT", "2020-02-03", "EMPLOYEE", "mdizon", "18.25", "22.5"],
  ["2021-012", "Kristine", "S", "Lumbay", "FEMALE", "Bookkeeper I", 8, "23500", "MACCO", "PERMANENT", "2021-06-01", "EMPLOYEE", "klumbay", "12", "14.5"],
  ["2016-025", "Rodel", "G", "Tampus", "MALE", "Engineer II", 16, "45000", "MEO", "PERMANENT", "2016-10-03", "EMPLOYEE", "rtampus", "40.75", "52"],
  ["2022-008", "Aileen", "J", "Bacus", "FEMALE", "Social Welfare Assistant", 8, "23500", "MSWDO", "PERMANENT", "2022-03-14", "EMPLOYEE", "abacus", "6.5", "9.25"],
  ["2017-019", "Lorna", "F", "Cabahug", "FEMALE", "Nurse II", 16, "45000", "MHO", "PERMANENT", "2017-01-09", "EMPLOYEE", "lcabahug", "28", "3.5"],
  ["2023-002", "Jerome", "V", "Omandam", "MALE", "Midwife II", 11, "30000", "MHO", "PERMANENT", "2023-07-03", "EMPLOYEE", "jomandam", "3.75", "4"],
  ["2019-037", "Cherry", "N", "Galarrita", "FEMALE", "Administrative Aide IV", 4, "17500", "MO", "PERMANENT", "2019-11-04", "EMPLOYEE", "cgalarrita", "21", "26.75"],
  ["2024-011", "Paolo", "E", "Sumalpong", "MALE", "Utility Worker I", 1, "14000", "MEO", "CASUAL", "2024-01-15", "EMPLOYEE", "psumalpong", "2.5", "3"],
];

// ── Holidays 2026 ────────────────────────────────────────────
const HOLIDAYS: [date: string, name: string][] = [
  ["2026-01-01", "New Year's Day"],
  ["2026-04-02", "Maundy Thursday"],
  ["2026-04-03", "Good Friday"],
  ["2026-04-09", "Araw ng Kagitingan"],
  ["2026-05-01", "Labor Day"],
  ["2026-06-12", "Independence Day"],
  ["2026-08-21", "Ninoy Aquino Day"],
  ["2026-08-31", "National Heroes Day"],
  ["2026-11-01", "All Saints' Day"],
  ["2026-11-02", "All Souls' Day"],
  ["2026-11-30", "Bonifacio Day"],
  ["2026-12-08", "Feast of the Immaculate Conception"],
  ["2026-12-24", "Christmas Eve"],
  ["2026-12-25", "Christmas Day"],
  ["2026-12-30", "Rizal Day"],
  ["2026-12-31", "Last Day of the Year"],
];

/** "2026-02" -> "2026-02-28" */
function lastDayOfMonth(month: string) {
  const [year, m] = month.split("-").map(Number);
  // Day 0 of the next month is the last day of this month.
  return new Date(Date.UTC(year, m, 0)).toISOString().slice(0, 10);
}

/** "2026-01" -> "January 2026" */
const monthLabel = (month: string) => format(new Date(`${month}-01T00:00:00`), "MMMM yyyy");

async function main() {
  // 1. Offices first, without heads (the heads don't exist yet).
  for (const [id, name] of OFFICES) {
    await db.office.upsert({ where: { id }, update: { name }, create: { id, name } });
  }

  // 2. Employees. The password is only set when the account is first created,
  //    so re-running the seed never resets a password that was changed.
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  for (const row of EMPLOYEES) {
    const [employeeNo, firstName, middleInitial, lastName, sex, position, salaryGrade, monthlySalary, officeId, status, originalAppointment, role, username] = row;
    const profile = {
      firstName,
      middleInitial,
      lastName,
      sex,
      position,
      salaryGrade,
      monthlySalary,
      officeId,
      status,
      originalAppointment: toDbDate(originalAppointment),
      role,
      username: normalizeUsername(username),
    };
    await db.employee.upsert({
      where: { employeeNo },
      update: profile,
      create: { employeeNo, ...profile, passwordHash },
    });
  }

  // 3. Now set each office head.
  for (const [id, , headUsername] of OFFICES) {
    const head = await db.employee.findUniqueOrThrow({ where: { username: normalizeUsername(headUsername) } });
    await db.office.update({ where: { id }, data: { headId: head.id } });
  }

  // 4. Leave types (defaults explained at the top of src/lib/leave-types.ts).
  for (const [index, t] of LEAVE_TYPES.entries()) {
    const data = {
      name: t.name,
      legalBasis: t.legalBasis,
      ruleNote: t.ruleNote,
      deductsFrom: t.deductsFrom,
      detailKind: t.detailKind,
      convertible: t.convertible,
      maxDaysPerYear: t.maxDaysPerYear,
      eligibleStatuses: t.eligibleStatuses,
      sortOrder: index + 1,
    };
    await db.leaveType.upsert({ where: { code: t.code }, update: data, create: { code: t.code, ...data } });
  }

  // 5. Holidays.
  for (const [date, name] of HOLIDAYS) {
    await db.holiday.upsert({ where: { date: toDbDate(date) }, update: { name }, create: { date: toDbDate(date), name } });
  }

  // 6. Opening balances from the paper leave cards.
  for (const row of EMPLOYEES) {
    const [employeeNo, , , , , , , , , , , , , openingVL, openingSL] = row;
    const employee = await db.employee.findUniqueOrThrow({ where: { employeeNo } });
    const openings = [
      { kind: "VL" as const, amount: new Prisma.Decimal(openingVL) },
      { kind: "SL" as const, amount: new Prisma.Decimal(openingSL) },
    ];
    for (const { kind, amount } of openings) {
      if (amount.isZero()) continue;
      const exists = await db.ledgerEntry.findFirst({
        where: { employeeId: employee.id, kind, particulars: OPENING_PARTICULARS },
      });
      if (exists) continue;
      await db.ledgerEntry.create({
        data: { employeeId: employee.id, kind, date: toDbDate(OPENING_DATE), particulars: OPENING_PARTICULARS, earned: amount },
      });
    }
  }

  // 7. Monthly accrual Jan–Aug 2026 (1.25 VL + 1.25 SL) for active employees covered by
  //    civil service leave rules (not Elective, COS or JO).
  const earners = await db.employee.findMany({ where: { active: true, status: { in: CREDIT_EARNING_STATUSES } } });
  const accrual = new Prisma.Decimal(MONTHLY_ACCRUAL);
  for (const employee of earners) {
    for (const month of ACCRUAL_MONTHS) {
      for (const kind of ["VL", "SL"] as const) {
        await db.ledgerEntry.upsert({
          where: { employeeId_kind_accrualMonth: { employeeId: employee.id, kind, accrualMonth: month } },
          update: {},
          create: {
            employeeId: employee.id,
            kind,
            accrualMonth: month,
            date: toDbDate(lastDayOfMonth(month)),
            particulars: `Earned – ${monthLabel(month)}`,
            earned: accrual,
          },
        });
      }
    }
  }

  // 8. Settings.
  const lastMonth = ACCRUAL_MONTHS[ACCRUAL_MONTHS.length - 1];
  await db.appSetting.upsert({
    where: { key: "lastAccrualMonth" },
    update: { value: lastMonth },
    create: { key: "lastAccrualMonth", value: lastMonth },
  });

  await printSummary(earners.length);
}

async function printSummary(earnerCount: number) {
  const [offices, officesWithHead, employees, leaveTypes, holidays, openingRows, accrualRows, applications, noFiler] = await Promise.all([
    db.office.count(),
    db.office.count({ where: { headId: { not: null } } }),
    db.employee.count(),
    db.leaveType.count(),
    db.holiday.count(),
    db.ledgerEntry.count({ where: { particulars: OPENING_PARTICULARS } }),
    db.ledgerEntry.count({ where: { accrualMonth: { not: null } } }),
    db.leaveApplication.count(),
    db.leaveApplication.count({ where: { filedById: null } }),
  ]);

  console.log("\nSeed complete:");
  console.log(`  offices      ${offices} (with head: ${officesWithHead})`);
  console.log(`  employees    ${employees}`);
  console.log(`  leave types  ${leaveTypes}`);
  console.log(`  holidays     ${holidays}`);
  console.log(`  ledger       ${openingRows} opening rows, ${accrualRows} accrual rows (expected ${earnerCount * ACCRUAL_MONTHS.length * 2})`);
  // Every application must record who encoded it (the employee, or an HRMO on their behalf).
  console.log(`  applications ${applications} (without filedBy: ${noFiler})`);

  // Sanity check against the prototype: Liza Dalisay (hrmo).
  const liza = await db.employee.findUniqueOrThrow({ where: { username: "hrmo" } });
  for (const [kind, expected] of [["VL", "122.5"], ["SL", "150.25"]] as const) {
    const sum = await db.ledgerEntry.aggregate({
      where: { employeeId: liza.id, kind },
      _sum: { earned: true, deducted: true },
    });
    const balance = (sum._sum.earned ?? new Prisma.Decimal(0)).minus(sum._sum.deducted ?? 0);
    const ok = balance.equals(expected) ? "OK" : `MISMATCH (expected ${expected})`;
    console.log(`  Liza Dalisay ${kind} balance = ${balance.toFixed(3)}  ${ok}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
