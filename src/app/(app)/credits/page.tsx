// Leave Credits: the electronic leave card (ledger) with running VL and SL balances.
// Who sees which card (?emp=<employee id>):
//   everyone: their own card;
//   HRMO and Approving Authority: any employee's card (search by name);
//   department head: the employees of the office they head.
import Link from "next/link";
import { connection } from "next/server";
import { Search } from "lucide-react";
import type { Prisma } from "@/generated/prisma/client";
import { CreditCards } from "@/components/leave/credit-cards";
import { PrintButton } from "@/components/print-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { rolesFor } from "@/config/nav";
import { APP, EMPLOYMENT_STATUS_LABELS } from "@/lib/constants";
import { db } from "@/lib/db";
import { fromDbDate } from "@/lib/dates";
import { fmtDate } from "@/lib/format";
import { leaveCardRows } from "@/lib/leave-card";
import { cn, fullName } from "@/lib/utils";
import type { CurrentUser } from "@/server/auth";
import { requireRole } from "@/server/auth";
import { credits } from "@/server/leave";

/** May this user see the leave card of `employee`? */
function canViewCard(user: CurrentUser, employee: { id: string; office: { headId: string | null } }) {
  if (employee.id === user.id) return true;
  if (user.role === "HRMO" || user.role === "APPROVER") return true;
  return user.role === "DEPT_HEAD" && employee.office.headId === user.id;
}

/** Leave card amounts: always 3 decimals, as on the prototype's leave card ("1.250"). Blank for zero. */
const amount = (value: Prisma.Decimal, blankIfZero = true) => (blankIfZero && value.isZero() ? "" : value.toFixed(3));

export default async function CreditsPage({ searchParams }: { searchParams: Promise<{ emp?: string; q?: string }> }) {
  await connection();
  const user = await requireRole(...rolesFor("/credits"));
  const params = await searchParams;
  const canPick = user.role !== "EMPLOYEE";
  const q = (params.q ?? "").trim();

  const employee = await db.employee.findUnique({
    where: { id: params.emp || user.id },
    select: {
      id: true,
      employeeNo: true,
      firstName: true,
      middleInitial: true,
      lastName: true,
      position: true,
      status: true,
      originalAppointment: true,
      office: { select: { name: true, headId: true } },
    },
  });
  if (!employee || !canViewCard(user, employee)) {
    return (
      <Card className="mx-auto max-w-md text-center">
        <CardHeader>
          <CardTitle>No access</CardTitle>
          <CardDescription>You cannot view this leave card.</CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/credits" className="text-sm font-medium text-brand-600 hover:underline">
            Back to my leave credits
          </Link>
        </CardContent>
      </Card>
    );
  }

  const own = employee.id === user.id;
  const [c, entries, choices] = await Promise.all([
    credits(db, employee.id),
    db.ledgerEntry.findMany({
      where: { employeeId: employee.id },
      select: { date: true, particulars: true, kind: true, earned: true, deducted: true },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    }),
    canPick ? findEmployees(user, q) : [],
  ]);
  const rows = leaveCardRows(entries.map((e) => ({ ...e, date: fromDbDate(e.date) })));

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{own ? "My Leave Credits" : "Employee Leave Card"}</h1>
          <p className="mt-1 text-sm text-slate-500">Electronic leave card: monthly accruals and deductions with running balances.</p>
        </div>
        <PrintButton label="Print leave card" variant="outline" />
      </div>

      {canPick && (
        <Card className="mb-6 gap-3 p-4 print:hidden">
          <form className="flex gap-2">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                name="q"
                defaultValue={q}
                className="pl-9"
                placeholder={user.role === "DEPT_HEAD" ? "Search your office's employees by name…" : "Search any employee by name…"}
              />
            </div>
            <Button type="submit">Search</Button>
          </form>
          {choices.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {choices.map((x) => (
                <Link
                  key={x.id}
                  href={`/credits?emp=${x.id}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs hover:bg-slate-50",
                    x.id === employee.id && "border-brand-600 bg-brand-50 font-semibold text-brand-700",
                  )}
                >
                  {x.lastName}, {x.firstName} · {x.officeId}
                </Link>
              ))}
            </div>
          ) : (
            q && <p className="text-xs text-slate-500">No employee matches “{q}”.</p>
          )}
          {!own && (
            <Link href="/credits" className="text-xs font-medium text-brand-600 hover:underline">
              Back to my own leave card
            </Link>
          )}
        </Card>
      )}

      <div className="mb-6 print:hidden">
        <CreditCards credits={c} status={employee.status} own={own} />
      </div>

      <Card className="print-area gap-0 py-0">
        <CardHeader className="border-b py-4">
          <CardTitle>
            Leave Card: {fullName(employee)} <span className="font-normal text-slate-500">({employee.employeeNo})</span>
          </CardTitle>
          <CardDescription>
            {employee.position} · {employee.office.name} · {EMPLOYMENT_STATUS_LABELS[employee.status]} · Original appointment{" "}
            {fmtDate(employee.originalAppointment)} · {APP.agency}
          </CardDescription>
        </CardHeader>
        {rows.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-500">No ledger entries yet.</p>
        ) : (
          <Table className="text-xs">
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead rowSpan={2} className="px-3">Date</TableHead>
                <TableHead rowSpan={2} className="px-3">Particulars</TableHead>
                <TableHead colSpan={3} className="border-l px-3 text-center">Vacation Leave</TableHead>
                <TableHead colSpan={3} className="border-l px-3 text-center">Sick Leave</TableHead>
              </TableRow>
              <TableRow>
                <TableHead className="border-l px-3 text-right">Earned</TableHead>
                <TableHead className="px-3 text-right">Availed</TableHead>
                <TableHead className="px-3 text-right">Balance</TableHead>
                <TableHead className="border-l px-3 text-right">Earned</TableHead>
                <TableHead className="px-3 text-right">Availed</TableHead>
                <TableHead className="px-3 text-right">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="tabular-nums">
              {rows.map((r) => (
                <TableRow key={`${r.date}|${r.particulars}`}>
                  <TableCell className="whitespace-nowrap px-3 text-slate-500">{fmtDate(r.date)}</TableCell>
                  <TableCell className="whitespace-normal px-3">{r.particulars}</TableCell>
                  <TableCell className="border-l px-3 text-right">{amount(r.vlEarned)}</TableCell>
                  <TableCell className="px-3 text-right text-red-600">{amount(r.vlDeducted)}</TableCell>
                  <TableCell className="px-3 text-right font-semibold">{amount(r.vlBalance, false)}</TableCell>
                  <TableCell className="border-l px-3 text-right">{amount(r.slEarned)}</TableCell>
                  <TableCell className="px-3 text-right text-red-600">{amount(r.slDeducted)}</TableCell>
                  <TableCell className="px-3 text-right font-semibold">{amount(r.slBalance, false)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </>
  );
}

/** Employees the picker may offer: matching every typed word against first or last name (any case). */
async function findEmployees(user: CurrentUser, q: string) {
  const words = q.split(/\s+/).filter(Boolean);
  const ownOffice = user.role === "DEPT_HEAD";
  if (!ownOffice && words.length === 0) return []; // HRMO / approver: type a name first
  return db.employee.findMany({
    where: {
      office: ownOffice ? { headId: user.id } : undefined,
      AND: words.map((w) => ({
        OR: [{ firstName: { contains: w, mode: "insensitive" as const } }, { lastName: { contains: w, mode: "insensitive" as const } }],
      })),
    },
    select: { id: true, firstName: true, lastName: true, officeId: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    take: 30,
  });
}
