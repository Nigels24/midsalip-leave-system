// Leave Records: every leave application, newest first, with search, filters and paging in the URL
// (?q=&status=&type=&office=&year=&page=). The database does all the filtering and paging.
// Who sees what: the HRMO and the Approving Authority see all applications; a department head sees
// the applications of the office they head (the same rule as opening /applications/[id]).
import Link from "next/link";
import { connection } from "next/server";
import { Search } from "lucide-react";
import type { ApplicationStatus, Prisma } from "@/generated/prisma/client";
import { ApplicationsTable } from "@/components/leave/applications-table";
import { buildHref, Pagination, selectClass } from "@/components/list-controls";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { rolesFor } from "@/config/nav";
import { STATUS_LABELS } from "@/lib/constants";
import { db } from "@/lib/db";
import { toDbDate, todayInManila, yearOf } from "@/lib/dates";
import { requireRole } from "@/server/auth";

const PAGE_SIZE = 20;

type SearchParams = { q?: string; status?: string; type?: string; office?: string; year?: string; page?: string };

export default async function RecordsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await connection();
  const user = await requireRole(...rolesFor("/records"));
  const params = await searchParams;
  const scopedToOffice = user.role === "DEPT_HEAD";

  const q = (params.q ?? "").trim();
  const status = params.status && params.status in STATUS_LABELS ? (params.status as ApplicationStatus) : undefined;
  const type = params.type || undefined;
  const office = scopedToOffice ? undefined : params.office || undefined; // a head cannot pick another office
  const year = /^\d{4}$/.test(params.year ?? "") ? Number(params.year) : undefined;
  const page = Math.max(1, Number(params.page) || 1);

  // Every word typed must match the reference number, first name or last name
  // (so "mark dizon" finds Mark A. Dizon). mode "insensitive" ignores upper/lower case.
  const words = q.split(/\s+/).filter(Boolean);
  const where: Prisma.LeaveApplicationWhereInput = {
    employee: scopedToOffice ? { office: { headId: user.id } } : office ? { officeId: office } : undefined,
    status,
    typeCode: type,
    startDate: year ? { gte: toDbDate(`${year}-01-01`), lte: toDbDate(`${year}-12-31`) } : undefined,
    AND: words.map((w) => ({
      OR: [
        { refNo: { contains: w, mode: "insensitive" } },
        { employee: { firstName: { contains: w, mode: "insensitive" } } },
        { employee: { lastName: { contains: w, mode: "insensitive" } } },
      ],
    })),
  };

  const [total, applications, leaveTypes, offices, range] = await Promise.all([
    db.leaveApplication.count({ where }),
    db.leaveApplication.findMany({
      where,
      include: {
        leaveType: { select: { name: true } },
        employee: { select: { firstName: true, middleInitial: true, lastName: true, office: { select: { id: true, name: true } } } },
      },
      orderBy: { filedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.leaveType.findMany({ select: { code: true, name: true }, orderBy: { sortOrder: "asc" } }),
    scopedToOffice ? [] : db.office.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.leaveApplication.aggregate({ _min: { startDate: true }, _max: { startDate: true } }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtered = Boolean(q || status || type || office || year);

  // Year choices: from the earliest to the latest leave on record (at least the current year).
  const thisYear = yearOf(todayInManila());
  const firstYear = Math.min(range._min.startDate?.getUTCFullYear() ?? thisYear, thisYear);
  const lastYear = Math.max(range._max.startDate?.getUTCFullYear() ?? thisYear, thisYear);
  const years = Array.from({ length: lastYear - firstYear + 1 }, (_, i) => lastYear - i);

  const pageHref = (n: number) => buildHref("/records", { q, status, type, office, year, page: n > 1 ? n : undefined });

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Leave Records</h1>
        <p className="mt-1 text-sm text-slate-500">
          {scopedToOffice ? `All applications filed by personnel of the ${user.office.name}.` : "All leave applications filed in the municipal hall."}
        </p>
      </div>

      <Card className="gap-0 py-0">
        <form className="grid gap-2 border-b p-4 sm:grid-cols-2 lg:grid-cols-6">
          <div className="relative lg:col-span-2">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input name="q" defaultValue={q} className="pl-9" placeholder="Search reference no. or employee name…" />
          </div>
          <select name="status" defaultValue={status ?? ""} className={selectClass} aria-label="Status">
            <option value="">All statuses</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select name="type" defaultValue={type ?? ""} className={selectClass} aria-label="Leave type">
            <option value="">All leave types</option>
            {leaveTypes.map((t) => (
              <option key={t.code} value={t.code}>
                {t.name}
              </option>
            ))}
          </select>
          {!scopedToOffice && (
            <select name="office" defaultValue={office ?? ""} className={selectClass} aria-label="Office">
              <option value="">All offices</option>
              {offices.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          )}
          <select name="year" defaultValue={year ?? ""} className={selectClass} aria-label="Year">
            <option value="">All years</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <div className="flex gap-2 sm:col-span-2 lg:col-span-6 lg:justify-end">
            <Button type="submit">Filter</Button>
            {filtered && (
              <Button asChild variant="outline">
                <Link href="/records">Clear</Link>
              </Button>
            )}
          </div>
        </form>

        <ApplicationsTable
          applications={applications}
          showEmployee
          showOffice
          empty={filtered ? "No applications match these filters." : "No leave applications have been filed yet."}
        />

        <Pagination page={page} pages={pages} shown={applications.length} total={total} hrefFor={pageHref} />
      </Card>
    </>
  );
}
