// Production seed: only what a real install needs to start. No demo employees, no demo signatures.
//   npm run db:seed:production      (npm run setup runs it for you)
//
// What it creates:
//   - the 7 offices (only on a new install, so offices the HRMO renamed are not added back),
//     the 14 leave types and the listed holidays of this year and next year (prisma/seed-data.ts;
//     only for a year that has no holidays yet, so the HRMO's edits on /holidays are kept);
//   - two starter accounts, because approvals need an HRMO and an Approving Authority:
//       "hrmo"  (HRMO, heads the Human Resource Management Office)
//       "mayor" (Approving Authority, heads the Office of the Municipal Mayor)
//     Their names are placeholders: edit them on Employees & Accounts after the first login.
//     Their first password is SEED_ADMIN_PASSWORD from .env (made by scripts/setup-env.mjs).
//   - The other offices start WITHOUT a head (one person can head only one office).
//     Their employees cannot file leave until the HRMO adds the real head and sets it.
//
// Safe to run again: existing rows are never overwritten (except leave type rules, which follow
// the code), and a password is only set when the account is first created.
import "dotenv/config";
import bcrypt from "bcryptjs";
import type { EmploymentStatus, Role, Sex } from "../src/generated/prisma/client";
import { db } from "../src/lib/db";
import { toDbDate, todayInManila, yearOf } from "../src/lib/dates";
import { normalizeUsername } from "../src/lib/utils";
import { OFFICES, seedHolidays, seedLeaveTypes } from "./seed-data";

interface StarterAccount {
  username: string;
  employeeNo: string;
  firstName: string;
  lastName: string;
  sex: Sex;
  position: string;
  officeId: string;
  status: EmploymentStatus;
  role: Role;
}

// Placeholder people. The HRMO replaces the names, sex, position and dates after the first login.
const STARTERS: StarterAccount[] = [
  {
    username: "hrmo",
    employeeNo: "START-HRMO",
    firstName: "Starter",
    lastName: "HRMO",
    sex: "FEMALE",
    position: "Human Resource Management Officer",
    officeId: "HRMO",
    status: "PERMANENT",
    role: "HRMO",
  },
  {
    username: "mayor",
    employeeNo: "START-MAYOR",
    firstName: "Starter",
    lastName: "Mayor",
    sex: "MALE",
    position: "Municipal Mayor",
    officeId: "MO",
    status: "ELECTIVE",
    role: "APPROVER",
  },
];

async function main() {
  // 1. Offices: only on a new install (no office yet). After that the HRMO adds and renames
  //    offices on Employees & Accounts, and the seed must not bring back an old code or name.
  if ((await db.office.count()) === 0) {
    await db.office.createMany({ data: OFFICES.map(([id, name]) => ({ id, name })) });
  }

  // 2. Leave types and holidays (this year and next year).
  await seedLeaveTypes(db);
  const thisYear = yearOf(todayInManila());
  const holidaysAdded = await seedHolidays(db, [thisYear, thisYear + 1]);

  // 3. Starter accounts: created only if the username does not exist yet,
  //    so a later edit or password change is never undone.
  const created: string[] = [];
  for (const s of STARTERS) {
    const username = normalizeUsername(s.username);
    let person = await db.employee.findUnique({ where: { username }, select: { id: true } });
    if (!person) {
      // The password is only needed here, so after the first setup the line can be deleted from .env.
      const password = process.env.SEED_ADMIN_PASSWORD ?? "";
      if (password.length < 8) {
        throw new Error("SEED_ADMIN_PASSWORD in .env must have at least 8 characters to create the starter accounts.");
      }
      person = await db.employee.create({
        data: {
          employeeNo: s.employeeNo,
          firstName: s.firstName,
          lastName: s.lastName,
          sex: s.sex,
          position: s.position,
          officeId: s.officeId,
          status: s.status,
          role: s.role,
          username,
          salaryGrade: 1,
          monthlySalary: "0",
          originalAppointment: toDbDate(todayInManila()),
          passwordHash: await bcrypt.hash(password, 10),
        },
        select: { id: true },
      });
      created.push(username);
    }
    // Their own office gets them as head, only while that office has no head.
    await db.office.updateMany({ where: { id: s.officeId, headId: null }, data: { headId: person.id } });
  }
  if (created.length > 0) {
    await db.auditLog.create({ data: { actorId: null, action: "SETUP", detail: `Starter accounts created: ${created.join(", ")}` } });
  }

  // 4. Summary.
  const [offices, withHead, employees, leaveTypes, holidayCount, holidaysThisYear] = await Promise.all([
    db.office.count(),
    db.office.count({ where: { headId: { not: null } } }),
    db.employee.count(),
    db.leaveType.count(),
    db.holiday.count(),
    db.holiday.count({ where: { date: { gte: toDbDate(`${thisYear}-01-01`), lte: toDbDate(`${thisYear}-12-31`) } } }),
  ]);
  console.log("\nProduction seed complete:");
  console.log(`  offices      ${offices} (with a head: ${withHead})`);
  console.log(`  leave types  ${leaveTypes}`);
  console.log(`  holidays     ${holidayCount} in total (${holidaysAdded} added now, ${holidaysThisYear} in ${thisYear})`);
  console.log(`  employees    ${employees}`);
  console.log(created.length > 0 ? `  created      ${created.join(", ")} (password = SEED_ADMIN_PASSWORD)` : "  starter accounts already exist (left unchanged)");
  if (holidaysThisYear === 0) console.log(`  NOTE: there are no holidays for ${thisYear} yet. The HRMO adds them on the Holidays page.`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
