// Reports (HRMO and Approving Authority, see src/config/nav.ts). One filter bar for all four reports,
// in the URL (?year=&office=&empStatus=&type=&status=). Each report is built by src/server/reports.ts,
// the same code the CSV export uses, so the screen and the file always agree.
import Link from "next/link";
import { connection } from "next/server";
import { Download } from "lucide-react";
import { buildHref, selectClass } from "@/components/list-controls";
import { PrintButton } from "@/components/print-button";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { rolesFor } from "@/config/nav";
import { APP, EMPLOYMENT_STATUS_LABELS, STATUS_LABELS } from "@/lib/constants";
import { db } from "@/lib/db";
import { todayInManila, yearOf } from "@/lib/dates";
import { fmtDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { requireRole } from "@/server/auth";
import { buildReport, filterParams, parseReportFilters, REPORT_KEYS, type ReportTable } from "@/server/reports";

type SearchParams = Record<string, string | undefined>;

export default async function ReportsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await connection();
  await requireRole(...rolesFor("/reports"));
  const filters = parseReportFilters(await searchParams);

  const [reports, offices, leaveTypes, range] = await Promise.all([
    Promise.all(REPORT_KEYS.map((key) => buildReport(key, filters))),
    db.office.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.leaveType.findMany({ select: { code: true, name: true }, orderBy: { sortOrder: "asc" } }),
    db.leaveApplication.aggregate({ _min: { startDate: true }, _max: { startDate: true } }),
  ]);
  const [employees, types, credits, monthly] = reports;

  // Year choices: from the earliest to the latest leave on record (always including this year).
  const thisYear = yearOf(todayInManila());
  const firstYear = Math.min(range._min.startDate?.getUTCFullYear() ?? thisYear, thisYear, filters.year);
  const lastYear = Math.max(range._max.startDate?.getUTCFullYear() ?? thisYear, thisYear, filters.year);
  const years = Array.from({ length: lastYear - firstYear + 1 }, (_, i) => lastYear - i);

  const officeName = offices.find((o) => o.id === filters.office)?.name ?? "All offices";
  const exportHref = (key: string) => buildHref(`/reports/export/${key}`, filterParams(filters));
  const filtered = Boolean(filters.office || filters.empStatus || filters.type || filters.status);

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Reports</h1>
          <p className="mt-1 text-sm text-slate-500">Leave utilization summaries generated directly from system records.</p>
        </div>
        <PrintButton label="Print reports" variant="outline" />
      </div>

      <Card className="mb-6 p-4 print:hidden">
        <form className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <select name="year" defaultValue={filters.year} className={selectClass} aria-label="Year">
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <select name="office" defaultValue={filters.office ?? ""} className={selectClass} aria-label="Office">
            <option value="">All offices</option>
            {offices.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
          <select name="empStatus" defaultValue={filters.empStatus ?? ""} className={selectClass} aria-label="Employment status">
            <option value="">All employment statuses</option>
            {Object.entries(EMPLOYMENT_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select name="type" defaultValue={filters.type ?? ""} className={selectClass} aria-label="Leave type">
            <option value="">All leave types</option>
            {leaveTypes.map((t) => (
              <option key={t.code} value={t.code}>
                {t.name}
              </option>
            ))}
          </select>
          <select name="status" defaultValue={filters.status ?? ""} className={selectClass} aria-label="Application status">
            <option value="">All application statuses</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <Button type="submit" className="flex-1">
              Apply
            </Button>
            {filtered && (
              <Button asChild variant="outline">
                <Link href={`/reports?year=${filters.year}`}>Clear</Link>
              </Button>
            )}
          </div>
        </form>
      </Card>

      <div className="print-area space-y-6">
        {/* Heading that only appears on paper. */}
        <div className="hidden text-center print:block">
          <p className="text-sm">{APP.agency}</p>
          <p className="font-semibold">{APP.office}</p>
          <p className="text-sm">
            Leave reports · {filters.year} · {officeName}
          </p>
        </div>

        <ReportCard table={employees} exportHref={exportHref("employees")} empty="No applications match these filters." />
        <ReportCard table={types} exportHref={exportHref("types")} empty="No leave types." />
        <ReportCard table={credits} exportHref={exportHref("credits")} empty="No active employees who earn credits match these filters." />
        <ReportCard table={monthly} exportHref={exportHref("monthly")} empty="">
          <MonthlyBars table={monthly} />
        </ReportCard>

        <p className="text-xs text-slate-500">
          Generated {fmtDateTime(new Date())} · {APP.name} {APP.subtitle}
        </p>
      </div>
    </>
  );
}

/** One report: heading, Export CSV link, optional extra content, and the table with its totals row. */
function ReportCard({ table, exportHref, empty, children }: { table: ReportTable; exportHref: string; empty: string; children?: React.ReactNode }) {
  const numeric = (i: number) => i >= table.textColumns;
  return (
    <Card className="gap-0 py-0 print:break-inside-avoid">
      <CardHeader className="flex flex-row items-start justify-between gap-3 border-b py-4">
        <div>
          <CardTitle>{table.title}</CardTitle>
          <CardDescription>{table.note}</CardDescription>
        </div>
        {/* A plain <a>: the CSV comes from a route handler, not a page. */}
        <Button asChild variant="outline" size="sm" className="print:hidden">
          <a href={exportHref}>
            <Download size={14} /> Export CSV
          </a>
        </Button>
      </CardHeader>
      {children}
      {table.rows.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-slate-500">{empty}</p>
      ) : (
        <Table className="text-xs">
          <TableHeader className="bg-slate-50">
            <TableRow>
              {table.headers.map((h, i) => (
                <TableHead key={h} className={cn("px-3", numeric(i) && "text-right")}>
                  {h}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody className="tabular-nums">
            {table.rows.map((row, r) => (
              <TableRow key={r}>
                {row.map((cell, i) => (
                  <TableCell key={i} className={cn("px-3", numeric(i) && "text-right")}>
                    {cell}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
          {table.totals && (
            <TableFooter className="tabular-nums">
              <TableRow>
                {table.totals.map((cell, i) => (
                  <TableCell key={i} className={cn("px-3 font-semibold", numeric(i) && "text-right")}>
                    {cell}
                  </TableCell>
                ))}
              </TableRow>
            </TableFooter>
          )}
        </Table>
      )}
    </Card>
  );
}

/** Approved days per month as plain CSS bars (no chart library). */
function MonthlyBars({ table }: { table: ReportTable }) {
  // Display only: the bar width is a percentage, so a JS number is fine here (the amounts stay strings).
  const days = table.rows.map((r) => Number(r[2]));
  const max = Math.max(1, ...days);
  return (
    <div className="space-y-1.5 border-b p-5">
      {table.rows.map((row, i) => (
        <div key={row[0]} className="grid grid-cols-[8rem_1fr_4.5rem] items-center gap-3 text-xs">
          <span className="text-slate-600">{row[0]}</span>
          <div className="h-4 rounded bg-slate-100">
            <div className="h-4 rounded bg-brand-500 print:bg-slate-500" style={{ width: `${(days[i] / max) * 100}%` }} />
          </div>
          <span className="text-right font-semibold tabular-nums">{row[2]}</span>
        </div>
      ))}
    </div>
  );
}
