// Dashboard: one page that adapts to the role. Everything is computed here, on the server.
//  - Everyone: greeting, today's date, own VL/SL balances, quick actions, own 5 latest applications.
//  - Department head, HRMO, Approving Authority: the For My Action queue (oldest first).
//  - HRMO and Approving Authority: municipal-hall counts and who is on leave today.
//    A department head sees the same counts for the office they head only.
import Link from "next/link";
import { connection } from "next/server";
import { ArrowRight, CalendarDays, CalendarCheck2, CheckCircle2, FilePlus2, FileText, Hourglass } from "lucide-react";
import type { ApplicationStatus, Prisma } from "@/generated/prisma/client";
import { CreditCards } from "@/components/leave/credit-cards";
import { StatusBadge } from "@/components/leave/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { NAV, rolesFor } from "@/config/nav";
import { OPEN_STATUSES, ROLE_LABELS, STATUS_LABELS } from "@/lib/constants";
import { db } from "@/lib/db";
import { toDbDate, todayInManila, yearOf } from "@/lib/dates";
import { fmtDate, fmtNum, fmtRange, fmtToday, greeting } from "@/lib/format";
import { fullName } from "@/lib/utils";
import { requireRole } from "@/server/auth";
import { credits, waitingForWhere } from "@/server/leave";

const person = { select: { firstName: true, middleInitial: true, lastName: true } } as const;

// Quick action buttons. Each one is shown only if the role may open that page (src/config/nav.ts).
const QUICK_ACTIONS = [
  { href: "/apply", icon: FilePlus2 },
  { href: "/applications", icon: FileText },
  { href: "/calendar", icon: CalendarDays },
];

export default async function DashboardPage() {
  await connection();
  const user = await requireRole(...rolesFor("/dashboard"));
  const today = todayInManila();
  const year = yearOf(today);

  const isSignatory = user.role !== "EMPLOYEE";
  const seesAll = user.role === "HRMO" || user.role === "APPROVER";
  // Department heads: only the office they head (same rule as Leave Records).
  const scope: Prisma.LeaveApplicationWhereInput = seesAll ? {} : { employee: { office: { headId: user.id } } };

  const [myCredits, recent] = await Promise.all([
    credits(db, user.id),
    db.leaveApplication.findMany({
      where: { employeeId: user.id },
      include: { leaveType: { select: { name: true } } },
      orderBy: { filedAt: "desc" },
      take: 5,
    }),
  ]);
  const hall = isSignatory ? await hallSummary(user, scope, today, year) : null;

  const actions = QUICK_ACTIONS.map((q) => ({ ...q, item: NAV.find((n) => n.href === q.href)! })).filter((q) =>
    q.item.roles.includes(user.role),
  );

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {greeting()}, {user.firstName}!
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {ROLE_LABELS[user.role]} · {user.office.name} · {fmtToday()}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {actions.map(({ href, icon: Icon, item }, i) => (
            <Button key={href} asChild variant={i === 0 ? "default" : "outline"}>
              <Link href={href}>
                <Icon size={16} /> {item.label}
              </Link>
            </Button>
          ))}
        </div>
      </div>

      <CreditCards credits={myCredits} status={user.status} />

      {hall && (
        <>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <Card className="gap-3 p-5">
              <Stat icon={<Hourglass size={18} />} label={`Pending applications${seesAll ? "" : " (my office)"}`} value={hall.pendingTotal} />
              <div className="space-y-2">
                {hall.pending.map((p) => (
                  <div key={p.status}>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-600">{STATUS_LABELS[p.status]}</span>
                      <span className="font-semibold tabular-nums">{p.count}</span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-slate-100">
                      <div className="h-1.5 rounded-full bg-amber-400" style={{ width: `${(p.count / Math.max(1, hall.pendingTotal)) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
            <Card className="p-5">
              <Stat icon={<CheckCircle2 size={18} />} label={`Approved in ${year}${seesAll ? "" : " (my office)"}`} value={hall.approvedThisYear} />
            </Card>
            <Card className="p-5">
              <Stat icon={<CalendarCheck2 size={18} />} label={`On leave today${seesAll ? "" : " (my office)"}`} value={hall.onLeaveToday.length} />
            </Card>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            <Card className="gap-0 py-0 lg:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between border-b py-4">
                <CardTitle>For My Action ({hall.queueCount})</CardTitle>
                <Link href="/approvals" className="text-sm font-medium text-brand-600 hover:underline">
                  Open queue
                </Link>
              </CardHeader>
              {hall.queue.length === 0 ? (
                <Empty>Nothing is waiting for your action.</Empty>
              ) : (
                <ul className="divide-y">
                  {hall.queue.map((a) => (
                    <li key={a.id}>
                      <Link href={`/applications/${a.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-800">{fullName(a.employee)}</p>
                          <p className="truncate text-xs text-slate-500">
                            {a.leaveType.name} · {fmtNum(a.days)} day(s) · {fmtRange(a.startDate, a.endDate)}
                          </p>
                        </div>
                        <span className="hidden text-xs text-slate-400 sm:block">Filed {fmtDate(a.filedAt)}</span>
                        <ArrowRight size={16} className="text-slate-300" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card className="gap-0 py-0">
              <CardHeader className="border-b py-4">
                <CardTitle>On leave today</CardTitle>
              </CardHeader>
              {hall.onLeaveToday.length === 0 ? (
                <Empty>Nobody{seesAll ? "" : " from your office"} is on approved leave today.</Empty>
              ) : (
                <ul className="divide-y">
                  {hall.onLeaveToday.map((a) => (
                    <li key={a.id} className="px-5 py-3">
                      <p className="truncate text-sm font-medium text-slate-800">{fullName(a.employee)}</p>
                      <p className="truncate text-xs text-slate-500">
                        {a.employee.office.id} · {a.leaveType.name} · until {fmtDate(a.endDate)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </>
      )}

      <Card className="mt-6 gap-0 py-0">
        <CardHeader className="flex flex-row items-center justify-between border-b py-4">
          <CardTitle>My recent applications</CardTitle>
          {rolesFor("/applications").includes(user.role) && (
            <Link href="/applications" className="text-sm font-medium text-brand-600 hover:underline">
              View all
            </Link>
          )}
        </CardHeader>
        {recent.length === 0 ? (
          <Empty>You have not filed any leave yet.</Empty>
        ) : (
          <ul className="divide-y">
            {recent.map((a) => (
              <li key={a.id}>
                <Link href={`/applications/${a.id}`} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 hover:bg-slate-50">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{a.leaveType.name}</p>
                    <p className="text-xs text-slate-500">
                      {fmtRange(a.startDate, a.endDate)} · {fmtNum(a.days)} day(s) · <span className="font-mono">{a.refNo}</span>
                    </p>
                  </div>
                  <StatusBadge status={a.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

/** Counts and lists for officers. `scope` limits them to one office for a department head. */
async function hallSummary(user: { id: string; role: Parameters<typeof waitingForWhere>[0]["role"] }, scope: Prisma.LeaveApplicationWhereInput, today: string, year: number) {
  const day = toDbDate(today);
  const [queueCount, queue, pendingGroups, approvedThisYear, onLeaveToday] = await Promise.all([
    db.leaveApplication.count({ where: waitingForWhere(user) }),
    db.leaveApplication.findMany({
      where: waitingForWhere(user),
      include: { employee: person, leaveType: { select: { name: true } } },
      orderBy: { filedAt: "asc" }, // oldest first: they have waited longest
      take: 5,
    }),
    db.leaveApplication.groupBy({ by: ["status"], where: { ...scope, status: { in: OPEN_STATUSES } }, _count: { _all: true } }),
    db.leaveApplication.count({
      where: {
        ...scope,
        status: "APPROVED",
        // approved (final action) since January 1 of this year, Philippine time
        actions: { some: { step: "APPROVED", createdAt: { gte: new Date(`${year}-01-01T00:00:00+08:00`) } } },
      },
    }),
    db.leaveApplication.findMany({
      where: { ...scope, status: "APPROVED", startDate: { lte: day }, endDate: { gte: day } },
      include: {
        employee: { select: { firstName: true, middleInitial: true, lastName: true, office: { select: { id: true } } } },
        leaveType: { select: { name: true } },
      },
      orderBy: [{ employee: { lastName: "asc" } }],
      take: 20,
    }),
  ]);

  const countOf = (status: ApplicationStatus) => pendingGroups.find((g) => g.status === status)?._count._all ?? 0;
  const pending = OPEN_STATUSES.map((status) => ({ status, count: countOf(status) }));
  return {
    queueCount,
    queue,
    pending,
    pendingTotal: pending.reduce((sum, p) => sum + p.count, 0),
    approvedThisYear,
    onLeaveToday,
  };
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">{icon}</span>
      <div>
        <p className="text-2xl font-bold tabular-nums text-slate-900">{value}</p>
        <p className="text-xs text-slate-500">{label}</p>
      </div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-5 py-8 text-center text-sm text-slate-500">{children}</p>;
}
