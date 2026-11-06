// My Applications: the logged-in user's own leave applications, newest first.
// Filters and page number live in the URL (?q=&status=&type=&page=), and the database does
// the filtering and paging, so the page stays fast however many applications there are.
import Link from "next/link";
import { connection } from "next/server";
import { FilePlus2, Search } from "lucide-react";
import type { ApplicationStatus, Prisma } from "@/generated/prisma/client";
import { ApplicationsTable } from "@/components/leave/applications-table";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { rolesFor } from "@/config/nav";
import { STATUS_LABELS } from "@/lib/constants";
import { db } from "@/lib/db";
import { requireRole } from "@/server/auth";

const PAGE_SIZE = 15;

// Native <select> styled like the shadcn Input, so the filter form works without JavaScript.
const selectClass = "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs";

type SearchParams = { q?: string; status?: string; type?: string; page?: string };

export default async function MyApplicationsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await connection();
  const user = await requireRole(...rolesFor("/applications"));
  const params = await searchParams;

  const q = (params.q ?? "").trim();
  const status = params.status && params.status in STATUS_LABELS ? (params.status as ApplicationStatus) : undefined;
  const type = params.type || undefined;
  const page = Math.max(1, Number(params.page) || 1);

  // Only the user's own applications (employeeId = the user), whoever filed them.
  const where: Prisma.LeaveApplicationWhereInput = {
    employeeId: user.id,
    status,
    typeCode: type,
    OR: q
      ? [{ refNo: { contains: q, mode: "insensitive" } }, { leaveType: { name: { contains: q, mode: "insensitive" } } }]
      : undefined,
  };

  const [total, applications, leaveTypes] = await Promise.all([
    db.leaveApplication.count({ where }),
    db.leaveApplication.findMany({
      where,
      include: { leaveType: { select: { name: true } } },
      orderBy: { filedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.leaveType.findMany({ select: { code: true, name: true }, orderBy: { sortOrder: "asc" } }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtered = Boolean(q || status || type);

  /** Same filters, another page number. */
  const pageHref = (n: number) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (status) sp.set("status", status);
    if (type) sp.set("type", type);
    if (n > 1) sp.set("page", String(n));
    const s = sp.toString();
    return s ? `/applications?${s}` : "/applications";
  };

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">My Applications</h1>
          <p className="mt-1 text-sm text-slate-500">Track every leave you have filed and where it is in the approval process.</p>
        </div>
        <Button asChild>
          <Link href="/apply">
            <FilePlus2 size={16} /> File a leave
          </Link>
        </Button>
      </div>

      <Card className="gap-0 py-0">
        {/* A plain GET form: submitting it just changes the URL. */}
        <form className="grid gap-2 border-b p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input name="q" defaultValue={q} className="pl-9" placeholder="Search reference no. or leave type…" />
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
          <div className="flex gap-2">
            <Button type="submit" className="flex-1">
              Filter
            </Button>
            {filtered && (
              <Button asChild variant="outline">
                <Link href="/applications">Clear</Link>
              </Button>
            )}
          </div>
        </form>

        <ApplicationsTable
          applications={applications}
          empty={filtered ? "No applications match these filters." : "You have not filed any leave yet."}
        />

        <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-2.5 text-xs text-slate-500">
          <span>
            Showing {applications.length} of {total}
          </span>
          {pages > 1 && (
            <div className="flex items-center gap-2">
              <PageLink href={pageHref(page - 1)} disabled={page <= 1}>
                Previous
              </PageLink>
              <span>
                Page {page} of {pages}
              </span>
              <PageLink href={pageHref(page + 1)} disabled={page >= pages}>
                Next
              </PageLink>
            </div>
          )}
        </div>
      </Card>
    </>
  );
}

function PageLink({ href, disabled, children }: { href: string; disabled: boolean; children: React.ReactNode }) {
  if (disabled) return <span className="rounded-md border px-2.5 py-1 opacity-40">{children}</span>;
  return (
    <Link href={href} className="rounded-md border px-2.5 py-1 hover:bg-slate-50">
      {children}
    </Link>
  );
}
