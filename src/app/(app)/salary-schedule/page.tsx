// Salary Schedule (HRMO only): the LGU percentage, the national monthly salary schedule with the
// amount this LGU pays, editing one amount, and importing a new schedule every year.
// Changes go through src/server/salary-rules.ts. The employee forms use the effective amounts to
// fill in the salary grade and step from the monthly salary.
import { connection } from "next/server";
import { Info } from "lucide-react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { rolesFor } from "@/config/nav";
import { db } from "@/lib/db";
import { requireRole } from "@/server/auth";
import { getSalaryPercent, loadSchedule } from "@/server/salary-rules";
import { ImportForm } from "./import-form";
import { PercentForm } from "./percent-form";
import { ScheduleTable } from "./schedule-table";

export default async function SalarySchedulePage() {
  await connection();
  await requireRole(...rolesFor("/salary-schedule"));
  const [{ percent, isSet }, rows] = await Promise.all([getSalaryPercent(db), loadSchedule(db)]);
  const percentText = percent.toString(); // plain string for the client components (never a Decimal)

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Salary Schedule</h1>
        <p className="mt-1 text-sm text-slate-500">
          The national monthly salary schedule (salary grades 1 to 33, Steps 1 to 8; grade 33 has Steps 1 and 2) and the
          amount this LGU pays. When you type an employee&apos;s monthly salary on Add or Edit employee, the salary grade and
          step are filled in from this schedule.
        </p>
      </div>

      <div className="mb-6 flex gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <Info size={18} className="mt-0.5 shrink-0" />
        <div className="space-y-1">
          <p>
            <b>Amount for this LGU = national amount × the percentage, rounded to the nearest peso</b> (50 centavos and up
            round up). This rounding follows the usual payroll practice of whole-peso salary rates.
          </p>
          <p>
            Check the amounts against the salary schedule approved by the Sangguniang Bayan. If an amount differs, edit
            the national amount or the percentage.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="h-fit gap-0 py-0">
          <CardHeader className="border-b py-4">
            <CardTitle>LGU percentage</CardTitle>
            <CardDescription>
              The percentage of the national schedule this municipality pays, as set by the Sangguniang Bayan according to
              its income class (DBM Local Budget Circular No. 172 for 2026).
            </CardDescription>
          </CardHeader>
          <div className="p-5">
            <PercentForm percent={percentText} isSet={isSet} />
          </div>
        </Card>

        <Card className="gap-0 py-0 lg:col-span-2">
          <CardHeader className="border-b py-4">
            <CardTitle>Import a new schedule</CardTitle>
            <CardDescription>
              Every year, when DBM issues the new salary schedule, paste it here: one line per grade and step, as{" "}
              <span className="font-mono">grade,step,amount</span> (the national amount). Lines copied from Excel also work.
            </CardDescription>
          </CardHeader>
          <div className="p-5">
            <ImportForm />
          </div>
        </Card>
      </div>

      <Card className="mt-6 gap-0 py-0">
        <CardHeader className="border-b py-4">
          <CardTitle>Monthly salary schedule</CardTitle>
          <CardDescription>
            Each cell shows the amount for this LGU ({percentText}%) and, below it, the national amount. Click a cell to edit
            its national amount.
          </CardDescription>
        </CardHeader>
        {rows.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-muted-foreground">
            <p className="font-medium text-slate-700">The salary schedule is empty.</p>
            <p className="mt-1">
              Paste the national schedule in <b>Import a new schedule</b> above. Until then, the employee forms cannot fill in
              the salary grade and step.
            </p>
          </div>
        ) : (
          <ScheduleTable rows={rows} percent={percentText} />
        )}
      </Card>
    </>
  );
}
