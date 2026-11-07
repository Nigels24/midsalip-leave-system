// VL and SL balance cards (same as the prototype's CreditCards). Server component: it receives
// the result of credits() from src/server/leave and only formats it.
// Employees whose status does not earn credits (COS, JO, elective) get a short note instead.
import type { EmploymentStatus } from "@/generated/prisma/client";
import { Card } from "@/components/ui/card";
import { EMPLOYMENT_STATUS_LABELS } from "@/lib/constants";
import { fmtNum } from "@/lib/format";
import { CREDIT_EARNING_STATUSES } from "@/lib/leave-types";
import type { Credits } from "@/server/leave";

export function CreditCards({ credits: c, status, own = true }: { credits: Credits; status: EmploymentStatus; own?: boolean }) {
  if (!CREDIT_EARNING_STATUSES.includes(status)) {
    return (
      <Card className="p-5 text-sm text-slate-600">
        {own ? "Your" : "This"} employment status ({EMPLOYMENT_STATUS_LABELS[status]}) does not earn vacation or sick leave credits.
        Leave types that do not use credits can still be filed where allowed.
      </Card>
    );
  }

  const cards = [
    { label: "Vacation Leave", balance: c.vl, pending: c.vlPending, available: c.vlAvailable, dot: "bg-brand-500" },
    { label: "Sick Leave", balance: c.sl, pending: c.slPending, available: c.slAvailable, dot: "bg-sky-500" },
  ];
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {cards.map((r) => (
        <Card key={r.label} className="gap-0 p-5">
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${r.dot}`} />
            <p className="text-sm font-medium text-slate-600">{r.label}</p>
          </div>
          <p className="mt-2 text-3xl font-bold tabular-nums text-slate-900">
            {fmtNum(r.balance)} <span className="text-base font-medium text-slate-500">days</span>
          </p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
            <span>
              Pending: <b className="text-slate-700">{fmtNum(r.pending)}</b>
            </span>
            <span>
              Available to file: <b className="text-slate-700">{fmtNum(r.available)}</b>
            </span>
          </div>
        </Card>
      ))}
    </div>
  );
}
