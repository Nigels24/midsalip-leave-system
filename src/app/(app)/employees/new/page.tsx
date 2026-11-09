// Add employee and issue their account (HRMO only).
import Link from "next/link";
import { connection } from "next/server";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { rolesFor } from "@/config/nav";
import { db } from "@/lib/db";
import { todayInManila } from "@/lib/dates";
import { requireRole } from "@/server/auth";
import { loadEffectiveSchedule } from "@/server/salary-rules";
import { EmployeeForm } from "../employee-form";

export default async function NewEmployeePage() {
  await connection();
  await requireRole(...rolesFor("/employees"));
  const [offices, schedule] = await Promise.all([
    db.office.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    loadEffectiveSchedule(db), // plain numbers (whole pesos), never Decimal
  ]);

  return (
    <>
      <Link href="/employees" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft size={16} /> Employees &amp; Accounts
      </Link>
      <h1 className="mb-6 text-2xl font-bold tracking-tight text-slate-900">Add employee</h1>
      <Card className="max-w-3xl">
        <CardContent>
          <EmployeeForm
            offices={offices}
            schedule={schedule}
            values={{
              employeeNo: "",
              firstName: "",
              middleInitial: "",
              lastName: "",
              sex: "FEMALE",
              position: "",
              salaryGrade: "",
              salaryStep: "",
              monthlySalary: "",
              officeId: offices[0]?.id ?? "",
              status: "PERMANENT",
              role: "EMPLOYEE",
              originalAppointment: todayInManila(),
              username: "",
            }}
          />
        </CardContent>
      </Card>
    </>
  );
}
