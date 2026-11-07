// Reports: each report is built ONCE here as a plain table of strings. The page shows it and the
// CSV export (/reports/export/[report]) downloads it, so both always show the same numbers.
// Amounts are added with Prisma.Decimal and shown with 3 decimals ("12.500").
// The year is the year the leave STARTS in, as everywhere else in the system.
import { Prisma, type ApplicationStatus, type EmploymentStatus } from "../generated/prisma/client";
import { monthLabel } from "../lib/calendar";
import { EMPLOYMENT_STATUS_LABELS, STATUS_LABELS } from "../lib/constants";
import { db } from "../lib/db";
import { fromDbDate, toDbDate, todayInManila, yearOf } from "../lib/dates";
import { CREDIT_EARNING_STATUSES } from "../lib/leave-types";
import { monthlyTotals, sumDecimals } from "../lib/report-math";
import { fullName } from "../lib/utils";

export const REPORT_KEYS = ["employees", "types", "credits", "monthly"] as const;
export type ReportKey = (typeof REPORT_KEYS)[number];

export interface ReportFilters {
  year: number;
  office?: string;
  empStatus?: EmploymentStatus;
  type?: string; // leave type code
  status?: ApplicationStatus;
}

export interface ReportTable {
  key: ReportKey;
  title: string;
  note: string; // which filters apply, shown under the title
  headers: string[];
  rows: string[][];
  totals: string[] | null;
  textColumns: number; // the first N columns are text (left aligned); the rest are numbers
}

type Params = Record<string, string | undefined>;

/** Reads the filters from the URL (?year=&office=&empStatus=&type=&status=). Bad values are ignored. */
export function parseReportFilters(params: Params): ReportFilters {
  const year = /^\d{4}$/.test(params.year ?? "") ? Number(params.year) : yearOf(todayInManila());
  return {
    year,
    office: params.office || undefined,
    empStatus: params.empStatus && params.empStatus in EMPLOYMENT_STATUS_LABELS ? (params.empStatus as EmploymentStatus) : undefined,
    type: params.type || undefined,
    status: params.status && params.status in STATUS_LABELS ? (params.status as ApplicationStatus) : undefined,
  };
}

/** The filters as URL params again (for the export links). */
export function filterParams(f: ReportFilters) {
  return { year: f.year, office: f.office, empStatus: f.empStatus, type: f.type, status: f.status };
}

const fmt = (d: Prisma.Decimal) => d.toFixed(3);
const ZERO = new Prisma.Decimal(0);

/** Applications that START in the year and match the filters. */
function applicationWhere(f: ReportFilters, statusOverride?: ApplicationStatus): Prisma.LeaveApplicationWhereInput {
  return {
    startDate: { gte: toDbDate(`${f.year}-01-01`), lte: toDbDate(`${f.year}-12-31`) },
    typeCode: f.type,
    status: statusOverride ?? f.status,
    employee: { officeId: f.office, status: f.empStatus },
  };
}

const employeeName = { select: { firstName: true, middleInitial: true, lastName: true, officeId: true } } as const;

// ── a) Leave summary by employee ─────────────────────────────

async function byEmployee(f: ReportFilters): Promise<ReportTable> {
  const [apps, types] = await Promise.all([
    db.leaveApplication.findMany({
      where: applicationWhere(f),
      select: { employeeId: true, typeCode: true, status: true, days: true, employee: employeeName },
    }),
    db.leaveType.findMany({ select: { code: true }, orderBy: { sortOrder: "asc" } }),
  ]);
  const approved = apps.filter((a) => a.status === "APPROVED");
  // One column per leave type that has approved days (keeps the table narrow).
  const typeCodes = types.map((t) => t.code).filter((code) => approved.some((a) => a.typeCode === code));

  const people = new Map<string, { name: string; office: string; sortName: string }>();
  for (const a of apps) {
    people.set(a.employeeId, { name: fullName(a.employee), office: a.employee.officeId, sortName: `${a.employee.lastName} ${a.employee.firstName}` });
  }
  const daysOf = (list: typeof apps) => sumDecimals(list.map((a) => a.days));

  const rows = [...people.entries()]
    .sort(([, a], [, b]) => a.sortName.localeCompare(b.sortName))
    .map(([id, p]) => {
      const mine = approved.filter((a) => a.employeeId === id);
      return [
        p.name,
        p.office,
        String(apps.filter((a) => a.employeeId === id).length),
        fmt(daysOf(mine)),
        ...typeCodes.map((code) => fmt(daysOf(mine.filter((a) => a.typeCode === code)))),
      ];
    });

  return {
    key: "employees",
    title: "Leave summary by employee",
    note: `Applications starting in ${f.year} that match the filters; day columns count approved leave only.`,
    headers: ["Employee", "Office", "Applications", "Approved days", ...typeCodes.map((c) => `${c} days`)],
    rows,
    totals: ["Total", "", String(apps.length), fmt(daysOf(approved)), ...typeCodes.map((code) => fmt(daysOf(approved.filter((a) => a.typeCode === code))))],
    textColumns: 2,
  };
}

// ── b) Leave summary by leave type ───────────────────────────

async function byType(f: ReportFilters): Promise<ReportTable> {
  const [apps, types] = await Promise.all([
    db.leaveApplication.findMany({ where: applicationWhere(f), select: { typeCode: true, status: true, days: true } }),
    db.leaveType.findMany({ where: { code: f.type }, select: { code: true, name: true }, orderBy: { sortOrder: "asc" } }),
  ]);
  const count = (list: typeof apps, status: ApplicationStatus) => list.filter((a) => a.status === status).length;
  const approvedDays = (list: typeof apps) => sumDecimals(list.filter((a) => a.status === "APPROVED").map((a) => a.days));

  const rows = types.map((t) => {
    const mine = apps.filter((a) => a.typeCode === t.code);
    return [t.name, String(mine.length), fmt(approvedDays(mine)), String(count(mine, "DISAPPROVED")), String(count(mine, "CANCELLED"))];
  });
  return {
    key: "types",
    title: "Leave summary by leave type",
    note: `Applications starting in ${f.year} that match the filters.`,
    headers: ["Leave type", "Applications", "Approved days", "Disapproved", "Cancelled"],
    rows,
    totals: ["Total", String(apps.length), fmt(approvedDays(apps)), String(count(apps, "DISAPPROVED")), String(count(apps, "CANCELLED"))],
    textColumns: 1,
  };
}

// ── c) Leave credits summary ─────────────────────────────────

async function creditsSummary(f: ReportFilters): Promise<ReportTable> {
  const today = todayInManila();
  // Only statuses that earn credits; the employment status filter can narrow it further.
  const statuses = f.empStatus ? CREDIT_EARNING_STATUSES.filter((s) => s === f.empStatus) : CREDIT_EARNING_STATUSES;
  const employees = await db.employee.findMany({
    where: { active: true, status: { in: statuses }, officeId: f.office },
    select: { id: true, firstName: true, middleInitial: true, lastName: true, officeId: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
  const ids = employees.map((e) => e.id);

  const [balances, used] = await Promise.all([
    // Balance as of today = earned minus deducted, for every entry dated today or earlier (same as balance()).
    db.ledgerEntry.groupBy({
      by: ["employeeId", "kind"],
      where: { employeeId: { in: ids }, date: { lte: toDbDate(today) } },
      _sum: { earned: true, deducted: true },
    }),
    // Days deducted on the leave card during the selected year.
    db.ledgerEntry.groupBy({
      by: ["employeeId"],
      where: { employeeId: { in: ids }, date: { gte: toDbDate(`${f.year}-01-01`), lte: toDbDate(`${f.year}-12-31`) } },
      _sum: { deducted: true },
    }),
  ]);
  const balanceOf = (id: string, kind: "VL" | "SL") => {
    const g = balances.find((b) => b.employeeId === id && b.kind === kind);
    return (g?._sum.earned ?? ZERO).minus(g?._sum.deducted ?? ZERO);
  };
  const usedOf = (id: string) => used.find((u) => u.employeeId === id)?._sum.deducted ?? ZERO;

  return {
    key: "credits",
    title: "Leave credits summary",
    note: `Active employees who earn credits. Balances as of today (${today}); "used" is VL + SL deducted in ${f.year}. Leave type and application status filters do not apply.`,
    headers: ["Employee", "Office", "VL balance", "SL balance", `Used in ${f.year}`],
    rows: employees.map((e) => [fullName(e), e.officeId, fmt(balanceOf(e.id, "VL")), fmt(balanceOf(e.id, "SL")), fmt(usedOf(e.id))]),
    totals: ["Total", "", "", "", fmt(sumDecimals(employees.map((e) => usedOf(e.id))))],
    textColumns: 2,
  };
}

// ── d) Monthly trend ─────────────────────────────────────────

async function monthly(f: ReportFilters): Promise<ReportTable> {
  const apps = await db.leaveApplication.findMany({ where: applicationWhere(f, "APPROVED"), select: { startDate: true, days: true } });
  const months = monthlyTotals(apps.map((a) => ({ startDate: fromDbDate(a.startDate), days: a.days })), f.year);
  return {
    key: "monthly",
    title: "Monthly trend",
    note: `Approved leave by the month it starts in, ${f.year}. The application status filter does not apply (approved only).`,
    headers: ["Month", "Approved applications", "Approved days"],
    rows: months.map((m) => [monthLabel(m.month), String(m.count), fmt(m.days)]),
    totals: ["Total", String(apps.length), fmt(sumDecimals(apps.map((a) => a.days)))],
    textColumns: 1,
  };
}

const BUILDERS: Record<ReportKey, (f: ReportFilters) => Promise<ReportTable>> = {
  employees: byEmployee,
  types: byType,
  credits: creditsSummary,
  monthly,
};

/** Builds one report. Callers check the role first (requireRole(...rolesFor("/reports"))). */
export function buildReport(key: ReportKey, filters: ReportFilters) {
  return BUILDERS[key](filters);
}
