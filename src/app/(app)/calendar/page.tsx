// Leave Calendar: a month grid (Sunday first) with holidays and leave per day, to plan office staffing.
// ?month=2026-11 picks the month, ?office=MTO the office.
// Who sees what: employees and department heads see their own office only; the HRMO and the
// Approving Authority see all offices and can filter by office.
// A chip links to the application only if the user may open it (canViewApplication). For leave the
// user may not open, the chip shows the name only, not the type of leave (it can be sensitive).
import Link from "next/link";
import { connection } from "next/server";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buildHref, selectClass } from "@/components/list-controls";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { rolesFor } from "@/config/nav";
import { leaveOnDay, monthGrid, monthLabel, parseMonth, shiftMonth } from "@/lib/calendar";
import { OPEN_STATUSES } from "@/lib/constants";
import { db } from "@/lib/db";
import { fromDbDate, toDbDate, todayInManila } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { canViewApplication } from "@/server/application-access";
import { requireRole } from "@/server/auth";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MAX_CHIPS = 3;

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ month?: string; office?: string }> }) {
  await connection();
  const user = await requireRole(...rolesFor("/calendar"));
  const params = await searchParams;
  const today = todayInManila();
  const month = parseMonth(params.month, today);
  const days = monthGrid(month);
  const first = days[0].iso;
  const last = days[days.length - 1].iso;

  const seesAll = user.role === "HRMO" || user.role === "APPROVER";
  const office = seesAll ? params.office || undefined : user.officeId; // others: their own office only

  const [holidayRows, applications, offices] = await Promise.all([
    db.holiday.findMany({ where: { date: { gte: toDbDate(first), lte: toDbDate(last) } } }),
    db.leaveApplication.findMany({
      where: {
        status: { in: ["APPROVED", ...OPEN_STATUSES] },
        startDate: { lte: toDbDate(last) }, // overlaps the days shown
        endDate: { gte: toDbDate(first) },
        employee: office ? { officeId: office } : undefined,
      },
      select: {
        id: true,
        employeeId: true,
        typeCode: true,
        status: true,
        startDate: true,
        endDate: true,
        leaveType: { select: { name: true } },
        employee: { select: { firstName: true, lastName: true, office: { select: { headId: true } } } },
      },
      orderBy: [{ startDate: "asc" }, { employee: { lastName: "asc" } }],
    }),
    seesAll ? db.office.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }) : [],
  ]);

  const holidays = new Map(holidayRows.map((h) => [fromDbDate(h.date), h.name]));
  const holidaySet = new Set(holidays.keys());
  // Plain strings only from here on: the grid compares "YYYY-MM-DD" strings.
  const leave = applications.map((a) => {
    const canOpen = canViewApplication(user, a);
    const pending = a.status !== "APPROVED";
    const name = `${a.employee.firstName} ${a.employee.lastName[0]}.`;
    return {
      id: a.id,
      typeCode: a.typeCode,
      startDate: fromDbDate(a.startDate),
      endDate: fromDbDate(a.endDate),
      pending,
      sick: canOpen && a.typeCode === "SL", // the blue colour would also reveal the type, so only when allowed
      href: canOpen ? `/applications/${a.id}` : null,
      label: canOpen ? `${name} · ${a.typeCode}` : name,
      title: `${a.employee.firstName} ${a.employee.lastName}${canOpen ? ` – ${a.leaveType.name}` : " – on leave"}${pending ? " (pending)" : ""}`,
    };
  });

  const monthHref = (m: string | undefined) => buildHref("/calendar", { month: m, office: seesAll ? office : undefined });

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Leave Calendar</h1>
          <p className="mt-1 text-sm text-slate-500">
            {seesAll ? "See who is on leave to plan office staffing." : `Leave in the ${user.office.name}.`}
          </p>
        </div>
        {seesAll && (
          <form className="flex gap-2">
            <input type="hidden" name="month" value={month} />
            <select name="office" defaultValue={office ?? ""} className={cn(selectClass, "w-60")} aria-label="Office">
              <option value="">All offices</option>
              {offices.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
            <Button type="submit" variant="outline">
              Show
            </Button>
          </form>
        )}
      </div>

      <Card className="gap-0 py-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <Button asChild variant="ghost" size="sm">
            <Link href={monthHref(shiftMonth(month, -1))} aria-label="Previous month">
              <ChevronLeft size={18} />
            </Link>
          </Button>
          <div className="text-center">
            <p className="font-semibold">{monthLabel(month)}</p>
            <Link href={monthHref(undefined)} className="text-xs text-brand-600 hover:underline">
              Today
            </Link>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link href={monthHref(shiftMonth(month, 1))} aria-label="Next month">
              <ChevronRight size={18} />
            </Link>
          </Button>
        </div>

        <div className="overflow-x-auto">
          <div className="grid min-w-[720px] grid-cols-7">
            {WEEKDAYS.map((d) => (
              <div key={d} className="border-b bg-slate-50 px-2 py-2 text-center text-xs font-semibold text-slate-500">
                {d}
              </div>
            ))}
            {days.map((day) => {
              const holiday = holidays.get(day.iso);
              const onLeave = leaveOnDay(leave, day, holidaySet);
              return (
                <div
                  key={day.iso}
                  className={cn("min-h-28 border-b border-r p-1.5", (!day.inMonth || day.weekend) && "bg-slate-50/70")}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span
                      className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs",
                        day.iso === today && "bg-brand-600 font-bold text-white",
                        !day.inMonth && day.iso !== today && "text-slate-300",
                      )}
                    >
                      {day.day}
                    </span>
                    {holiday && (
                      <span className="truncate text-[10px] text-red-500" title={holiday}>
                        {holiday}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 space-y-1">
                    {onLeave.slice(0, MAX_CHIPS).map((a) => {
                      const style = cn(
                        "block truncate rounded px-1.5 py-0.5 text-[11px]",
                        a.pending
                          ? "border border-dashed border-amber-400 bg-amber-50 text-amber-800"
                          : a.sick
                            ? "bg-sky-100 text-sky-800"
                            : "bg-brand-100 text-brand-900",
                        a.href && "hover:underline",
                      );
                      return a.href ? (
                        <Link key={a.id} href={a.href} title={a.title} className={style}>
                          {a.label}
                        </Link>
                      ) : (
                        <span key={a.id} title={a.title} className={style}>
                          {a.label}
                        </span>
                      );
                    })}
                    {onLeave.length > MAX_CHIPS && <p className="px-1 text-[10px] text-slate-500">+{onLeave.length - MAX_CHIPS} more</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap gap-4 px-4 py-3 text-xs text-slate-600">
          <Legend className="bg-brand-100" label="Approved leave" />
          <Legend className="bg-sky-100" label="Approved sick leave" />
          <Legend className="border border-dashed border-amber-400 bg-amber-50" label="Pending" />
          <span className="text-red-500">Red text: holiday</span>
        </div>
      </Card>
    </>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("h-3 w-3 rounded", className)} /> {label}
    </span>
  );
}
