// Which leave types an employee may file (panel revisions 1 to 3).
// getLeaveOptions() feeds the File Leave form: a type that is not allowed is shown
// greyed out with its reason. validateEligibility() enforces the same rules on the server.
import type { Employee, LeaveType, Prisma } from "../../generated/prisma/client";
import { EMPLOYMENT_STATUS_LABELS, OPEN_STATUSES } from "../../lib/constants";
import { toDbDate, todayInManila, yearOf } from "../../lib/dates";
import { FEMALE_ONLY_TYPES, MALE_ONLY_TYPES } from "../../lib/leave-types";
import { availableOf, credits, creditWord, ZERO, type Credits } from "./credits";
import { LeaveError } from "./errors";
import type { DbClient } from "./shared";

type EmployeeForRules = Pick<Employee, "id" | "sex" | "status">;

export interface LeaveOption {
  type: LeaveType;
  allowed: boolean;
  reason: string | null; // why it is not allowed (null when allowed)
  usedDays: Prisma.Decimal; // approved + still-open applications of this type this year
  remainingDays: Prisma.Decimal | null; // null = no yearly cap
  availableCredits: Prisma.Decimal | null; // only for types that deduct VL/SL
}

/**
 * Days of each leave type used in a year, counted by the start date of the leave.
 * Open applications count too, so the same days cannot be filed twice while waiting.
 */
async function usedDaysByType(client: DbClient, employeeId: string, year: number, typeCode?: string) {
  const rows = await client.leaveApplication.groupBy({
    by: ["typeCode"],
    where: {
      employeeId,
      typeCode,
      status: { in: [...OPEN_STATUSES, "APPROVED"] },
      startDate: { gte: toDbDate(`${year}-01-01`), lte: toDbDate(`${year}-12-31`) },
    },
    _sum: { days: true },
  });
  return new Map(rows.map((r) => [r.typeCode, r._sum.days ?? ZERO]));
}

/** Applies the rules to one leave type. The order decides which reason is shown first. */
function buildOption(employee: EmployeeForRules, type: LeaveType, usedDays: Prisma.Decimal, c: Credits, year: number): LeaveOption {
  const remainingDays = type.maxDaysPerYear ? atLeastZero(type.maxDaysPerYear.minus(usedDays)) : null;
  const availableCredits = type.deductsFrom ? availableOf(c, type.deductsFrom) : null;
  let reason: string | null = null;

  if (!type.eligibleStatuses.includes(employee.status)) {
    // Panel revision 1: benefits depend on the employment type.
    reason = `${type.name} is not available to ${EMPLOYMENT_STATUS_LABELS[employee.status]} employees.`;
  } else if (FEMALE_ONLY_TYPES.includes(type.code) && employee.sex !== "FEMALE") {
    reason = `${type.name} is for female employees only.`;
  } else if (MALE_ONLY_TYPES.includes(type.code) && employee.sex !== "MALE") {
    reason = `${type.name} is for male employees only.`;
  } else if (remainingDays !== null && remainingDays.lte(0)) {
    // Panel revision 3: once the yearly allowance is used up, the type cannot be chosen.
    reason = `All ${type.maxDaysPerYear} day(s) of ${type.name} allowed for ${year} are already used or pending.`;
  } else if (type.deductsFrom && availableCredits !== null && availableCredits.lte(0)) {
    reason = `No ${creditWord(type.deductsFrom)} leave credits available.`;
  }

  return { type, allowed: reason === null, reason, usedDays, remainingDays, availableCredits };
}

/** Never below zero (an old application may have used more than today's cap). */
function atLeastZero(value: Prisma.Decimal) {
  return value.lt(0) ? ZERO : value;
}

/** Every leave type, in form order, with whether this employee may file it this year. */
export async function getLeaveOptions(client: DbClient, employeeId: string, year: number = yearOf(todayInManila())) {
  const employee = await client.employee.findUnique({ where: { id: employeeId }, select: { id: true, sex: true, status: true } });
  if (!employee) throw new LeaveError("Employee not found.");

  const types = await client.leaveType.findMany({ orderBy: { sortOrder: "asc" } });
  const used = await usedDaysByType(client, employeeId, year);
  const c = await credits(client, employeeId);
  return types.map((type) => buildOption(employee, type, used.get(type.code) ?? ZERO, c, year));
}

/**
 * Called when filing: the same rules as getLeaveOptions(), plus the requested number of days
 * must fit in what is left of the yearly allowance and in the available credits.
 */
export async function validateEligibility(
  client: DbClient,
  employee: EmployeeForRules,
  type: LeaveType,
  days: Prisma.Decimal,
  year: number,
) {
  const used = (await usedDaysByType(client, employee.id, year, type.code)).get(type.code) ?? ZERO;
  const c = await credits(client, employee.id);
  const option = buildOption(employee, type, used, c, year);

  if (!option.allowed) throw new LeaveError(option.reason ?? "This leave type is not allowed.");

  if (option.remainingDays !== null && days.gt(option.remainingDays)) {
    throw new LeaveError(
      `${type.name} allows ${type.maxDaysPerYear} day(s) a year. Only ${option.remainingDays} day(s) are left for ${year}, but this application is for ${days} day(s).`,
    );
  }
  if (type.deductsFrom && option.availableCredits !== null && days.gt(option.availableCredits)) {
    // Same wording as the prototype's validateFile.
    throw new LeaveError(
      `Insufficient ${creditWord(type.deductsFrom)} leave credits. This application is for ${days} day(s) but only ${option.availableCredits} day(s) are available (balance less pending applications).`,
    );
  }
}
