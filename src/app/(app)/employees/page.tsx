// Employees & Accounts (HRMO only): search and filter employees (?q=&office=&status=&role=&active=&page=),
// add one, open one to edit, add or rename offices, change office heads, and post the monthly credits.
// All changes go through src/server/employee-rules.ts and office-rules.ts, which enforce the safety rules.
import Link from "next/link";
import { connection } from "next/server";
import { CalendarPlus, Search, UserPlus } from "lucide-react";
import type { EmploymentStatus, Prisma, Role } from "@/generated/prisma/client";
import { buildHref, Pagination, selectClass } from "@/components/list-controls";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { rolesFor } from "@/config/nav";
import { EMPLOYMENT_STATUS_LABELS, ROLE_LABELS } from "@/lib/constants";
import { db } from "@/lib/db";
import { fullName } from "@/lib/utils";
import { requireRole } from "@/server/auth";
import { AddOfficeButton, RenameOfficeButton } from "./office-form";
import { OfficeHeadForm } from "./office-head-form";

const PAGE_SIZE = 20;

type SearchParams = { q?: string; office?: string; status?: string; role?: string; active?: string; page?: string };

export default async function EmployeesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await connection();
  await requireRole(...rolesFor("/employees"));
  const params = await searchParams;

  const q = (params.q ?? "").trim();
  const office = params.office || undefined;
  const status = params.status && params.status in EMPLOYMENT_STATUS_LABELS ? (params.status as EmploymentStatus) : undefined;
  const role = params.role && params.role in ROLE_LABELS ? (params.role as Role) : undefined;
  const active = params.active === "active" || params.active === "inactive" ? params.active : undefined;
  const page = Math.max(1, Number(params.page) || 1);

  // Every word typed must match the first name, last name or username (any upper/lower case).
  const words = q.split(/\s+/).filter(Boolean);
  const where: Prisma.EmployeeWhereInput = {
    officeId: office,
    status,
    role,
    active: active ? active === "active" : undefined,
    AND: words.map((w) => ({
      OR: [
        { firstName: { contains: w, mode: "insensitive" } },
        { lastName: { contains: w, mode: "insensitive" } },
        { username: { contains: w, mode: "insensitive" } },
      ],
    })),
  };

  const [total, employees, offices] = await Promise.all([
    db.employee.count({ where }),
    db.employee.findMany({
      where,
      select: {
        id: true,
        employeeNo: true,
        firstName: true,
        middleInitial: true,
        lastName: true,
        position: true,
        status: true,
        role: true,
        username: true,
        active: true,
        office: { select: { id: true, name: true } },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.office.findMany({
      select: {
        id: true,
        name: true,
        head: { select: { firstName: true, middleInitial: true, lastName: true } },
        headId: true,
        employees: { where: { active: true }, select: { id: true, firstName: true, middleInitial: true, lastName: true, role: true }, orderBy: { lastName: "asc" } },
      },
      orderBy: { name: "asc" },
    }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtered = Boolean(q || office || status || role || active);
  const pageHref = (n: number) => buildHref("/employees", { q, office, status, role, active, page: n > 1 ? n : undefined });

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Employees &amp; Accounts</h1>
          <p className="mt-1 text-sm text-slate-500">Maintain employee profiles, system accounts, office heads and monthly credits.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/employees/accrual">
              <CalendarPlus size={16} /> Post monthly credits
            </Link>
          </Button>
          <Button asChild>
            <Link href="/employees/new">
              <UserPlus size={16} /> Add employee
            </Link>
          </Button>
        </div>
      </div>

      <Card className="gap-0 py-0">
        <form className="grid gap-2 border-b p-4 sm:grid-cols-2 lg:grid-cols-6">
          <div className="relative lg:col-span-2">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input name="q" defaultValue={q} className="pl-9" placeholder="Search name or username…" />
          </div>
          <select name="office" defaultValue={office ?? ""} className={selectClass} aria-label="Office">
            <option value="">All offices</option>
            {offices.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
          <select name="status" defaultValue={status ?? ""} className={selectClass} aria-label="Employment status">
            <option value="">All statuses</option>
            {Object.entries(EMPLOYMENT_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select name="role" defaultValue={role ?? ""} className={selectClass} aria-label="Role">
            <option value="">All roles</option>
            {Object.entries(ROLE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select name="active" defaultValue={active ?? ""} className={selectClass} aria-label="Account">
            <option value="">Active and inactive</option>
            <option value="active">Active only</option>
            <option value="inactive">Deactivated only</option>
          </select>
          <div className="flex gap-2 sm:col-span-2 lg:col-span-6 lg:justify-end">
            <Button type="submit">Filter</Button>
            {filtered && (
              <Button asChild variant="outline">
                <Link href="/employees">Clear</Link>
              </Button>
            )}
          </div>
        </form>

        {employees.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted-foreground">
            {filtered ? "No employees match these filters." : "No employees yet."}
          </p>
        ) : (
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="px-4">Name</TableHead>
                <TableHead className="px-4">Position</TableHead>
                <TableHead className="px-4">Office</TableHead>
                <TableHead className="px-4">Status</TableHead>
                <TableHead className="px-4">Role</TableHead>
                <TableHead className="px-4">Username</TableHead>
                <TableHead className="px-4">Account</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map((e) => (
                <TableRow key={e.id} className={e.active ? "" : "opacity-60"}>
                  <TableCell className="px-4">
                    <Link href={`/employees/${e.id}`} className="font-medium text-brand-600 hover:underline">
                      {fullName(e)}
                    </Link>
                    <p className="text-xs text-slate-500">{e.employeeNo}</p>
                  </TableCell>
                  <TableCell className="whitespace-normal px-4">{e.position}</TableCell>
                  <TableCell className="px-4" title={e.office.name}>
                    {e.office.id}
                  </TableCell>
                  <TableCell className="px-4">{EMPLOYMENT_STATUS_LABELS[e.status]}</TableCell>
                  <TableCell className="px-4">{ROLE_LABELS[e.role]}</TableCell>
                  <TableCell className="px-4 font-mono text-xs">{e.username}</TableCell>
                  <TableCell className="px-4">
                    {e.active ? (
                      <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="outline">Deactivated</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <Pagination page={page} pages={pages} shown={employees.length} total={total} hrefFor={pageHref} />
      </Card>

      <Card className="mt-6 gap-0 py-0">
        <CardHeader className="border-b py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <CardTitle>Offices</CardTitle>
              <CardDescription className="mt-1.5">
                The head recommends the leave of their office&apos;s staff. A change applies from now on: applications already
                recommended keep their recommender, and those still waiting for recommendation go to the new head. An Employee
                chosen as head becomes a Department Head. Offices are never deleted.
              </CardDescription>
            </div>
            <AddOfficeButton />
          </div>
        </CardHeader>
        <ul className="divide-y">
          {offices.map((o) => (
            <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800">
                  {o.name} <span className="ml-1 font-mono text-xs text-slate-500">{o.id}</span>
                </p>
                {o.head ? (
                  <p className="text-xs text-slate-500">
                    Head: {fullName(o.head)} · {o.employees.length} active employee(s)
                  </p>
                ) : (
                  <p className="text-xs text-amber-700">
                    No head yet: its employees cannot file leave until you set the head.
                    {o.employees.length === 0 && " Add an employee to this office first."}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <RenameOfficeButton officeId={o.id} name={o.name} />
                <OfficeHeadForm
                  officeId={o.id}
                  currentHeadId={o.headId}
                  candidates={o.employees.map((e) => ({ id: e.id, label: `${fullName(e)} · ${ROLE_LABELS[e.role]}` }))}
                />
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
