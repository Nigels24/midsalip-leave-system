// Colored badge for an application status (same colors as the prototype).
import type { ApplicationStatus } from "@/generated/prisma/client";
import { Badge } from "@/components/ui/badge";
import { STATUS_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";

const STATUS_STYLE: Record<ApplicationStatus, string> = {
  FOR_RECOMMENDATION: "bg-amber-50 text-amber-700 border-amber-200",
  FOR_CERTIFICATION: "bg-sky-50 text-sky-700 border-sky-200",
  FOR_APPROVAL: "bg-violet-50 text-violet-700 border-violet-200",
  APPROVED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  DISAPPROVED: "bg-red-50 text-red-700 border-red-200",
  CANCELLED: "bg-slate-100 text-slate-600 border-slate-200",
};

export function StatusBadge({ status }: { status: ApplicationStatus }) {
  return (
    <Badge variant="outline" className={cn("rounded-full px-2.5", STATUS_STYLE[status])}>
      {STATUS_LABELS[status]}
    </Badge>
  );
}
