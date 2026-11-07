// Post monthly credits (HRMO only). Pick a month (?month=2026-11, default: this month in Manila,
// never a future month), see who will get 1.25 VL and 1.25 SL, then confirm.
// The preview and the posting use the same function (src/server/leave/accrual.ts).
import Link from "next/link";
import { connection } from "next/server";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { rolesFor } from "@/config/nav";
import { isMonth, monthLabel } from "@/lib/calendar";
import { EMPLOYMENT_STATUS_LABELS, MONTHLY_ACCRUAL } from "@/lib/constants";
import { CREDIT_EARNING_STATUSES } from "@/lib/leave-types";
import { db } from "@/lib/db";
import { todayInManila } from "@/lib/dates";
import { requireRole } from "@/server/auth";
import { accrualPreview, LeaveError } from "@/server/leave";
import { PostButton } from "./post-button";

export default async function AccrualPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  await connection();
  await requireRole(...rolesFor("/employees"));
  const today = todayInManila();
  const thisMonth = today.slice(0, 7);
  const params = await searchParams;
  const month = isMonth(params.month) ? params.month : thisMonth;

  let preview: Awaited<ReturnType<typeof accrualPreview>> | null = null;
  let problem = "";
  try {
    preview = await accrualPreview(db, month, today);
  } catch (error) {
    if (!(error instanceof LeaveError)) throw error;
    problem = error.message; // e.g. a future month typed in the address bar
  }
  const last = await db.appSetting.findUnique({ where: { key: "lastAccrualMonth" } });

  return (
    <>
      <Link href="/employees" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft size={16} /> Employees &amp; Accounts
      </Link>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">Post monthly credits</h1>
      <p className="mb-6 mt-1 text-sm text-slate-500">
        Adds {MONTHLY_ACCRUAL} VL and {MONTHLY_ACCRUAL} SL to every active employee whose status earns credits (
        {CREDIT_EARNING_STATUSES.map((s) => EMPLOYMENT_STATUS_LABELS[s]).join(", ")}). Latest month posted: <b>{last ? monthLabel(last.value) : "none"}</b>.
      </p>

      <Card className="mb-6 p-4">
        <form className="flex flex-wrap items-end gap-2">
          <label className="space-y-1.5">
            <span className="block text-sm font-medium text-slate-700">Month</span>
            <Input type="month" name="month" defaultValue={month} max={thisMonth} required className="w-48" />
          </label>
          <Button type="submit" variant="outline">
            Preview
          </Button>
        </form>
      </Card>

      {problem && <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{problem}</p>}

      {preview && (
        <Card className="gap-0 py-0">
          <CardHeader className="border-b py-4">
            <CardTitle>
              {monthLabel(month)}: {preview.toPost.length} employee(s) to receive credits
            </CardTitle>
            <CardDescription>
              {preview.alreadyPosted} already have this month on their leave card
              {preview.notYetHired > 0 ? ` · ${preview.notYetHired} appointed after this month` : ""}. They are skipped.
            </CardDescription>
          </CardHeader>
          {preview.toPost.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-slate-500">Nothing to post for {monthLabel(month)}.</p>
          ) : (
            <>
              <ul className="max-h-96 divide-y overflow-y-auto">
                {preview.toPost.map((e) => (
                  <li key={e.id} className="flex justify-between px-5 py-2 text-sm">
                    <span className="text-slate-800">{e.name}</span>
                    <span className="text-xs text-slate-500">
                      {e.officeId} · +{MONTHLY_ACCRUAL} VL, +{MONTHLY_ACCRUAL} SL
                    </span>
                  </li>
                ))}
              </ul>
              <CardContent className="flex justify-end border-t py-4">
                <PostButton month={month} label={monthLabel(month)} count={preview.toPost.length} />
              </CardContent>
            </>
          )}
        </Card>
      )}
    </>
  );
}
