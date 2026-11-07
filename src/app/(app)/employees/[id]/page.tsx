// Edit one employee (HRMO only): profile fields, deactivate / reactivate, reset password.
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ArrowLeft, CheckCircle2, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { rolesFor } from "@/config/nav";
import { OPEN_STATUSES } from "@/lib/constants";
import { db } from "@/lib/db";
import { fromDbDate } from "@/lib/dates";
import { fullName } from "@/lib/utils";
import { requireRole } from "@/server/auth";
import { AccountPanel } from "./account-panel";
import { EmployeeForm } from "../employee-form";

export default async function EditEmployeePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  await connection();
  const user = await requireRole(...rolesFor("/employees"));
  const { id } = await params;
  const { created } = await searchParams;

  const [e, offices, openApplications] = await Promise.all([
    db.employee.findUnique({
      where: { id },
      omit: { passwordHash: true, signature: true }, // never loaded for this page
      include: { headOf: { select: { name: true } } },
    }),
    db.office.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.leaveApplication.count({ where: { employeeId: id, status: { in: OPEN_STATUSES } } }),
  ]);
  if (!e) notFound();

  return (
    <>
      <Link href="/employees" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft size={16} /> Employees &amp; Accounts
      </Link>

      {created === "1" && (
        <p className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <CheckCircle2 size={16} /> Account created. Give the username <b className="font-mono">{e.username}</b> and the temporary password to
          the employee.
        </p>
      )}

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{fullName(e)}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {e.position}
            {e.headOf ? ` · Head of the ${e.headOf.name}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {e.active ? (
            <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
              Active
            </Badge>
          ) : (
            <Badge variant="outline">Deactivated</Badge>
          )}
          <Button asChild variant="outline" size="sm">
            <Link href={`/credits?emp=${e.id}`}>
              <Wallet size={14} /> Leave card
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Employee profile</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Plain strings only for the client form: Decimal and Date are converted here. */}
            <EmployeeForm
              employeeId={e.id}
              offices={offices}
              values={{
                employeeNo: e.employeeNo,
                firstName: e.firstName,
                middleInitial: e.middleInitial ?? "",
                lastName: e.lastName,
                sex: e.sex,
                position: e.position,
                salaryGrade: String(e.salaryGrade),
                monthlySalary: e.monthlySalary.toString(),
                officeId: e.officeId,
                status: e.status,
                role: e.role,
                originalAppointment: fromDbDate(e.originalAppointment),
                username: e.username,
              }}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription>
              Username <span className="font-mono">{e.username}</span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AccountPanel
              employeeId={e.id}
              name={fullName(e)}
              active={e.active}
              isSelf={e.id === user.id}
              heads={e.headOf?.name ?? null}
              openApplications={openApplications}
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
