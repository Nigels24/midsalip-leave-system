// Holidays (HRMO only): the non-working holidays used to count working days when leave is filed.
// ?year= picks the year (default: this year in the Philippines). Changes go through
// src/server/holiday-rules.ts and affect only leave filed from now on.
import Link from "next/link";
import { connection } from "next/server";
import { Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { rolesFor } from "@/config/nav";
import { db } from "@/lib/db";
import { fromDbDate, toDbDate, todayInManila, yearOf } from "@/lib/dates";
import { fmtDate, fmtWeekday } from "@/lib/format";
import { cn } from "@/lib/utils";
import { requireRole } from "@/server/auth";
import { HolidayForm } from "./holiday-form";
import { HolidayRowActions } from "./holiday-row-actions";

export default async function HolidaysPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  await connection();
  await requireRole(...rolesFor("/holidays"));
  const params = await searchParams;

  // Years to choose from: the earliest holiday's year (or this year) up to next year plus one.
  const thisYear = yearOf(todayInManila());
  const [earliest, latest] = await Promise.all([
    db.holiday.findFirst({ orderBy: { date: "asc" }, select: { date: true } }),
    db.holiday.findFirst({ orderBy: { date: "desc" }, select: { date: true } }),
  ]);
  const fromYear = Math.min(earliest ? yearOf(fromDbDate(earliest.date)) : thisYear, thisYear);
  const toYear = Math.max(latest ? yearOf(fromDbDate(latest.date)) : thisYear, thisYear + 2);
  const years = Array.from({ length: toYear - fromYear + 1 }, (_, i) => fromYear + i);
  const year = years.includes(Number(params.year)) ? Number(params.year) : thisYear;

  const rows = await db.holiday.findMany({
    where: { date: { gte: toDbDate(`${year}-01-01`), lte: toDbDate(`${year}-12-31`) } },
    orderBy: { date: "asc" },
  });
  // Plain strings only for the client components (never a Date).
  const holidays = rows.map((h) => ({ date: fromDbDate(h.date), name: h.name }));

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Holidays</h1>
        <p className="mt-1 text-sm text-slate-500">
          Non-working holidays are skipped when the working days of a leave are counted (except Maternity Leave and
          SLBW, which count calendar days).
        </p>
      </div>

      <div className="mb-6 flex gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <Info size={18} className="mt-0.5 shrink-0" />
        <p>
          Adding, editing or deleting a holiday affects only leave filed from now on. Applications already filed keep
          the number of days counted when they were filed; they are never recounted.
        </p>
      </div>

      <nav className="mb-4 flex flex-wrap gap-2" aria-label="Year">
        {years.map((y) => (
          <Link
            key={y}
            href={y === thisYear ? "/holidays" : `/holidays?year=${y}`}
            className={cn(
              "rounded-md border px-3 py-1.5 text-sm",
              y === year ? "border-brand-600 bg-brand-600 text-white" : "bg-white text-slate-700 hover:bg-slate-50",
            )}
            aria-current={y === year ? "page" : undefined}
          >
            {y}
          </Link>
        ))}
      </nav>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="gap-0 py-0 lg:col-span-2">
          <CardHeader className="border-b py-4">
            <CardTitle>Holidays of {year}</CardTitle>
            <CardDescription>{holidays.length} holiday(s), in date order.</CardDescription>
          </CardHeader>
          {holidays.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-muted-foreground">
              <p className="font-medium text-slate-700">No holidays for {year} yet.</p>
              <p className="mt-1">
                Add the regular and special non-working holidays from the Malacañang proclamation for {year}. Until then,
                every weekday of {year} is counted as a working day.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="px-4">Date</TableHead>
                  <TableHead className="px-4">Day</TableHead>
                  <TableHead className="px-4">Holiday</TableHead>
                  <TableHead className="px-4 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {holidays.map((h) => {
                  const weekday = fmtWeekday(h.date);
                  const weekend = weekday === "Saturday" || weekday === "Sunday";
                  return (
                    <TableRow key={h.date}>
                      <TableCell className="px-4 font-medium">{fmtDate(h.date)}</TableCell>
                      <TableCell className="px-4">
                        {weekday}
                        {weekend && (
                          <Badge variant="outline" className="ml-2" title="Already not a working day">
                            weekend
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-normal px-4">{h.name}</TableCell>
                      <TableCell className="px-4 text-right">
                        <HolidayRowActions date={h.date} name={h.name} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </Card>

        <Card className="h-fit gap-0 py-0">
          <CardHeader className="border-b py-4">
            <CardTitle>Add holiday</CardTitle>
            <CardDescription>One row per non-working day. The date may be in any year.</CardDescription>
          </CardHeader>
          <div className="p-5">
            <HolidayForm />
          </div>
        </Card>
      </div>
    </>
  );
}
