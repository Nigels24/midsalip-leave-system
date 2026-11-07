// Employees & Accounts: every change to an employee, account, password or office head goes
// through these functions, so the safety rules hold no matter which page calls them.
// Like src/server/leave, each function takes the database client first (db or a transaction)
// and refuses with a LeaveError, whose message the page shows to the user.
//
// Safety rules:
//  1. The HRMO cannot deactivate themselves or change their own role.
//  2. There is always at least one active HRMO and one active Approving Authority.
//  3. An office head cannot be deactivated or moved to another office until another head is set.
//  4. An employee with open applications cannot be deactivated.
// Every change writes an AuditLog row. Passwords and hashes never go into the log.
import bcrypt from "bcryptjs";
import { z } from "zod";
import { Prisma, type EmploymentStatus, type Role } from "../generated/prisma/client";
import { EMPLOYMENT_STATUS_LABELS, OPEN_STATUSES, ROLE_LABELS } from "../lib/constants";
import { isIsoDate, toDbDate, todayInManila } from "../lib/dates";
import { CREDIT_EARNING_STATUSES } from "../lib/leave-types";
import { fullName, normalizeUsername } from "../lib/utils";
import { LeaveError } from "./leave/errors";
import { audit, inTransaction, type DbClient } from "./leave/shared";

/** Same cost as the seed, so all hashes are alike. */
const BCRYPT_ROUNDS = 10;
export const OPENING_PARTICULARS = "Opening balance";

// ── Validation (zod) ─────────────────────────────────────────

const ROLES = Object.keys(ROLE_LABELS) as [Role, ...Role[]];
const STATUSES = Object.keys(EMPLOYMENT_STATUS_LABELS) as [EmploymentStatus, ...EmploymentStatus[]];

export const passwordSchema = z
  .string()
  .min(8, "The password must have at least 8 characters.")
  .max(200, "The password is too long.");

/** A leave credit amount typed by the HRMO: empty = 0, up to 3 decimals, never negative. */
const creditAmount = z
  .string()
  .trim()
  .regex(/^(\d{1,4}(\.\d{1,3})?)?$/, "Opening balances are numbers with up to 3 decimals, e.g. 15.250.")
  .transform((v) => new Prisma.Decimal(v || "0"));

/** The fields the HRMO can edit (everything except the username and the password). */
export const employeeFieldsSchema = z.object({
  employeeNo: z.string().trim().min(1, "Employee ID No. is required.").max(30),
  firstName: z.string().trim().min(1, "First name is required.").max(60),
  middleInitial: z
    .string()
    .trim()
    .max(3)
    .transform((v) => v.replace(/\./g, "").toUpperCase() || null),
  lastName: z.string().trim().min(1, "Last name is required.").max(60),
  sex: z.enum(["MALE", "FEMALE"], "Choose the sex."),
  position: z.string().trim().min(1, "Position is required.").max(100),
  salaryGrade: z.coerce.number("Salary grade must be a number.").int().min(1, "Salary grade is 1 to 33.").max(33, "Salary grade is 1 to 33."),
  // Optional on the form; the column is required, so an empty salary is stored as 0.
  monthlySalary: z
    .string()
    .trim()
    .regex(/^(\d{1,9}(\.\d{1,2})?)?$/, "Monthly salary is a number with up to 2 decimals.")
    .transform((v) => new Prisma.Decimal(v || "0")),
  officeId: z.string().min(1, "Choose an office."),
  status: z.enum(STATUSES, "Choose the employment status."),
  role: z.enum(ROLES, "Choose the system role."),
  originalAppointment: z.string().refine(isIsoDate, "Enter the date of original appointment."),
});
export type EmployeeFields = z.infer<typeof employeeFieldsSchema>;

export const newEmployeeSchema = employeeFieldsSchema.extend({
  username: z
    .string()
    .transform(normalizeUsername)
    .pipe(z.string().regex(/^[a-z0-9._-]{3,30}$/, "Username: 3 to 30 letters, numbers, dots, dashes or underscores.")),
  password: passwordSchema,
  openingVL: creditAmount,
  openingSL: creditAmount,
});
export type NewEmployee = z.infer<typeof newEmployeeSchema>;

// ── Helpers ──────────────────────────────────────────────────

const OFFICERS: Role[] = ["HRMO", "APPROVER"];

/** Rule 2: refuse if this person is the last active HRMO / Approving Authority. */
async function keepOneActive(tx: DbClient, person: { id: string; role: Role; active: boolean; firstName: string; middleInitial: string | null; lastName: string }) {
  if (!person.active || !OFFICERS.includes(person.role)) return;
  const others = await tx.employee.count({ where: { role: person.role, active: true, id: { not: person.id } } });
  if (others === 0) {
    throw new LeaveError(`${fullName(person)} is the only active ${ROLE_LABELS[person.role]}. Give another active employee that role first.`);
  }
}

async function checkOffice(tx: DbClient, officeId: string) {
  if (!(await tx.office.findUnique({ where: { id: officeId }, select: { id: true } }))) throw new LeaveError("Choose a valid office.");
}

async function checkEmployeeNo(tx: DbClient, employeeNo: string, exceptId?: string) {
  const other = await tx.employee.findUnique({ where: { employeeNo }, select: { id: true } });
  if (other && other.id !== exceptId) throw new LeaveError(`Employee ID No. ${employeeNo} is already used by another employee.`);
}

/** Loads the employee with what the rules need. Never the password hash. */
async function loadEmployee(tx: DbClient, id: string) {
  const employee = await tx.employee.findUnique({
    where: { id },
    select: { id: true, firstName: true, middleInitial: true, lastName: true, username: true, role: true, active: true, officeId: true, headOf: { select: { id: true, name: true } } },
  });
  if (!employee) throw new LeaveError("Employee not found.");
  return employee;
}

// ── Create / update ──────────────────────────────────────────

/** Adds an employee and their account. Opening VL/SL go on the leave card as "Opening balance". */
export async function createEmployee(client: DbClient, input: NewEmployee, actorId: string) {
  return inTransaction(client, async (tx) => {
    if (await tx.employee.findUnique({ where: { username: input.username }, select: { id: true } })) {
      throw new LeaveError(`The username "${input.username}" is already taken. Choose another one.`);
    }
    await checkEmployeeNo(tx, input.employeeNo);
    await checkOffice(tx, input.officeId);
    const earns = CREDIT_EARNING_STATUSES.includes(input.status);
    if (!earns && (!input.openingVL.isZero() || !input.openingSL.isZero())) {
      throw new LeaveError(`${EMPLOYMENT_STATUS_LABELS[input.status]} employees do not earn VL/SL credits, so they have no opening balance.`);
    }

    const { password, openingVL, openingSL, originalAppointment, ...fields } = input;
    const employee = await tx.employee.create({
      data: { ...fields, originalAppointment: toDbDate(originalAppointment), passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS) },
      select: { id: true, firstName: true, middleInitial: true, lastName: true, username: true },
    });

    // Opening balances from the paper leave card, dated today, so the step 8 leave card starts from them.
    const date = toDbDate(todayInManila());
    for (const [kind, amount] of [["VL", openingVL], ["SL", openingSL]] as const) {
      if (amount.isZero()) continue;
      await tx.ledgerEntry.create({ data: { employeeId: employee.id, kind, date, particulars: OPENING_PARTICULARS, earned: amount } });
    }

    const opening = earns ? ` · opening VL ${openingVL.toFixed(3)}, SL ${openingSL.toFixed(3)}` : "";
    await audit(tx, actorId, "CREATE_ACCOUNT", `${fullName(employee)} (${employee.username}) · ${ROLE_LABELS[input.role]} · ${input.officeId}${opening}`);
    return employee.id;
  });
}

/**
 * Saves the edited fields. The username never changes.
 * Changing the employment status or sex only affects what the employee can file from now on;
 * applications already filed keep their own data and are not touched.
 */
export async function updateEmployee(client: DbClient, id: string, input: EmployeeFields, actorId: string) {
  return inTransaction(client, async (tx) => {
    const current = await loadEmployee(tx, id);
    const before = await tx.employee.findUniqueOrThrow({ where: { id }, omit: { passwordHash: true, signature: true } });

    if (input.role !== current.role) {
      if (id === actorId) throw new LeaveError("You cannot change your own role. Ask another HRMO.");
      await keepOneActive(tx, current); // e.g. the last HRMO cannot become an employee
      if (current.headOf && input.role === "EMPLOYEE") {
        throw new LeaveError(`${fullName(current)} heads the ${current.headOf.name}. Set another head first, then change the role.`);
      }
    }
    if (input.officeId !== current.officeId) {
      if (current.headOf) throw new LeaveError(`${fullName(current)} heads the ${current.headOf.name}. Set another head first, then move them.`);
      await checkOffice(tx, input.officeId);
    }
    await checkEmployeeNo(tx, input.employeeNo, id);

    const data = { ...input, originalAppointment: toDbDate(input.originalAppointment) };
    await tx.employee.update({ where: { id }, data });

    // Audit which fields changed (names only for salary, so the log stays short).
    const changed = (Object.keys(data) as (keyof typeof data)[]).filter((k) => String(before[k]) !== String(data[k]));
    await audit(tx, actorId, "UPDATE_ACCOUNT", `${fullName(input)} (${current.username}) · changed: ${changed.join(", ") || "nothing"}`);
  });
}

// ── Activate / deactivate ────────────────────────────────────

export async function setEmployeeActive(client: DbClient, id: string, active: boolean, actorId: string) {
  return inTransaction(client, async (tx) => {
    const employee = await loadEmployee(tx, id);
    if (employee.active === active) return; // nothing to do

    if (!active) {
      if (id === actorId) throw new LeaveError("You cannot deactivate your own account.");
      await keepOneActive(tx, employee);
      if (employee.headOf) {
        throw new LeaveError(`${fullName(employee)} heads the ${employee.headOf.name}. Set another head for that office first.`);
      }
      const open = await tx.leaveApplication.count({ where: { employeeId: id, status: { in: OPEN_STATUSES } } });
      if (open > 0) {
        throw new LeaveError(`${fullName(employee)} has ${open} open application(s). They must be approved, disapproved or cancelled first.`);
      }
    }

    await tx.employee.update({ where: { id }, data: { active } });
    // A deactivated user is signed out at once: getCurrentUser() checks `active` on every request.
    await audit(tx, actorId, active ? "REACTIVATE_ACCOUNT" : "DEACTIVATE_ACCOUNT", `${fullName(employee)} (${employee.username})`);
  });
}

// ── Passwords ────────────────────────────────────────────────

/** The HRMO sets a new temporary password. It is stored hashed and never shown again. */
export async function resetPassword(client: DbClient, id: string, newPassword: string, actorId: string) {
  return inTransaction(client, async (tx) => {
    const employee = await loadEmployee(tx, id);
    await tx.employee.update({ where: { id }, data: { passwordHash: await bcrypt.hash(newPassword, BCRYPT_ROUNDS) } });
    await audit(tx, actorId, "RESET_PASSWORD", `Password of ${fullName(employee)} (${employee.username}) was reset`);
  });
}

/**
 * Password recovery from the server console (scripts/reset-password.mjs), for when the only HRMO
 * forgot their password. Whoever can open a terminal on the server PC is trusted, so there is
 * no signed-in actor: the audit row has a null actor. Returns the employee's name for the message.
 */
export async function resetPasswordFromConsole(client: DbClient, username: string, newPassword: string) {
  return inTransaction(client, async (tx) => {
    const password = passwordSchema.safeParse(newPassword);
    if (!password.success) throw new LeaveError(password.error.issues[0]?.message ?? "Invalid password.");
    const employee = await tx.employee.findUnique({
      where: { username: normalizeUsername(username) },
      select: { id: true, firstName: true, middleInitial: true, lastName: true, username: true, active: true },
    });
    if (!employee) throw new LeaveError(`There is no account with the username "${normalizeUsername(username)}".`);
    if (!employee.active) throw new LeaveError(`The account "${employee.username}" is deactivated. Reactivate it first (another HRMO can do it on Employees & Accounts).`);

    await tx.employee.update({ where: { id: employee.id }, data: { passwordHash: await bcrypt.hash(password.data, BCRYPT_ROUNDS) } });
    await audit(tx, null, "RESET_PASSWORD", `Password of ${fullName(employee)} was reset from the server console`);
    return fullName(employee);
  });
}

/** Any user changes their own password; the current one must be right. */
export async function changeOwnPassword(client: DbClient, userId: string, currentPassword: string, newPassword: string) {
  return inTransaction(client, async (tx) => {
    const me = await tx.employee.findUnique({ where: { id: userId }, select: { username: true, passwordHash: true } });
    if (!me || !(await bcrypt.compare(currentPassword, me.passwordHash))) throw new LeaveError("Your current password is not correct.");
    if (currentPassword === newPassword) throw new LeaveError("The new password must be different from the current one.");
    await tx.employee.update({ where: { id: userId }, data: { passwordHash: await bcrypt.hash(newPassword, BCRYPT_ROUNDS) } });
    await audit(tx, userId, "CHANGE_PASSWORD", `${me.username} changed their password`);
  });
}

// ── Office heads ─────────────────────────────────────────────

/**
 * Makes an active employee of the office its head. Routing reads the head when it is needed,
 * so from now on recommendations of that office (including ones already waiting) go to the new head.
 * Applications already recommended are not changed. An Employee-role head becomes a Department Head,
 * so the For My Action page opens for them.
 */
export async function setOfficeHead(client: DbClient, officeId: string, employeeId: string, actorId: string) {
  return inTransaction(client, async (tx) => {
    const office = await tx.office.findUnique({ where: { id: officeId }, select: { id: true, name: true, headId: true } });
    if (!office) throw new LeaveError("Office not found.");
    if (office.headId === employeeId) return; // already the head

    const person = await loadEmployee(tx, employeeId);
    if (!person.active) throw new LeaveError(`${fullName(person)} is deactivated.`);
    if (person.officeId !== office.id) throw new LeaveError(`${fullName(person)} does not belong to the ${office.name}.`);
    if (person.headOf) throw new LeaveError(`${fullName(person)} already heads the ${person.headOf.name}.`);
    // Their own leave waiting for recommendation would otherwise be routed to themselves.
    const ownWaiting = await tx.leaveApplication.count({ where: { employeeId, status: "FOR_RECOMMENDATION" } });
    if (ownWaiting > 0) throw new LeaveError(`${fullName(person)} has their own leave waiting for recommendation. Finish it first.`);

    await tx.office.update({ where: { id: office.id }, data: { headId: person.id } });
    const promoted = person.role === "EMPLOYEE";
    if (promoted) await tx.employee.update({ where: { id: person.id }, data: { role: "DEPT_HEAD" } });
    await audit(tx, actorId, "SET_OFFICE_HEAD", `${office.name}: ${fullName(person)} is now the head${promoted ? " (role set to Department Head)" : ""}`);
  });
}
