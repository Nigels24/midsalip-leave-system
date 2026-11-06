// The routing & status timeline of one application (port of the prototype's Timeline).
// Four stages: filed -> recommendation -> certification -> final action.
import { Check, Circle, X } from "lucide-react";
import type { ActionStep, ApplicationStatus } from "@/generated/prisma/client";
import { fmtDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface TimelineAction {
  id: string;
  step: ActionStep;
  actorName: string;
  remarks: string;
  createdAt: Date;
}

const STAGES = ["Filed by applicant", "Recommendation (Dept. Head)", "Certification of credits (HRMO)", "Final action (Approving Authority)"];

// Which stage is waiting while the application is open.
const CURRENT_STAGE: Partial<Record<ApplicationStatus, number>> = { FOR_RECOMMENDATION: 1, FOR_CERTIFICATION: 2, FOR_APPROVAL: 3 };

const STEP_TEXT: Record<ActionStep, string> = {
  FILED: "filed",
  RECOMMENDED: "recommended",
  NOT_RECOMMENDED: "not recommended",
  CERTIFIED: "certified",
  APPROVED: "approved",
  DISAPPROVED: "disapproved",
  CANCELLED: "cancelled",
};

interface Props {
  status: ApplicationStatus;
  actions: TimelineAction[]; // oldest first
  applicantIsHead: boolean; // the head of an office has no recommendation step (see fileLeave)
}

export function Timeline({ status, actions, applicantIsHead }: Props) {
  const hasRecommendation = actions.some((a) => a.step === "RECOMMENDED" || a.step === "NOT_RECOMMENDED");
  const skippedRecommendation = applicantIsHead && !hasRecommendation;

  // Put each action on its stage, in the order they happened (DISAPPROVED can be stage 2 or 3,
  // so the order decides, like in the prototype).
  const done: (TimelineAction | undefined)[] = [actions.find((a) => a.step === "FILED"), undefined, undefined, undefined];
  let stage = skippedRecommendation ? 2 : 1;
  for (const action of actions) {
    if (action.step === "FILED" || action.step === "CANCELLED") continue;
    if (stage <= 3) done[stage++] = action;
  }
  const cancelled = actions.find((a) => a.step === "CANCELLED");
  const current = CURRENT_STAGE[status] ?? -1;

  return (
    <ol className="space-y-5">
      {STAGES.map((label, i) => {
        const a = done[i];
        const negative = a && (a.step === "NOT_RECOMMENDED" || a.step === "DISAPPROVED");
        const isCurrent = i === current;
        return (
          <li key={label} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full border-2",
                  a && !negative && "border-emerald-500 bg-emerald-500 text-white",
                  negative && "border-red-500 bg-red-500 text-white",
                  isCurrent && "border-amber-500 bg-amber-50 text-amber-600",
                  !a && !isCurrent && "border-slate-200 bg-white text-slate-300",
                )}
              >
                {a && !negative ? <Check size={14} /> : negative ? <X size={14} /> : <Circle size={8} fill="currentColor" />}
              </span>
              {i < STAGES.length - 1 && <span className={cn("mt-1 w-0.5 flex-1", a ? "bg-emerald-200" : "bg-slate-200")} />}
            </div>
            <div className="pb-1">
              <p className={cn("text-sm font-medium", a || isCurrent ? "text-slate-800" : "text-slate-400")}>{label}</p>
              {a && (
                <p className="text-xs text-slate-500">
                  {STEP_TEXT[a.step]} by {a.actorName} · {fmtDateTime(a.createdAt)}
                </p>
              )}
              {a?.remarks && <p className="mt-1 rounded-md bg-slate-50 px-2 py-1 text-xs text-slate-600">“{a.remarks}”</p>}
              {isCurrent && <p className="text-xs text-amber-600">Waiting for action</p>}
              {i === 1 && skippedRecommendation && <p className="text-xs text-slate-500">Not required — applicant is the head of office</p>}
            </div>
          </li>
        );
      })}
      {cancelled && <li className="text-sm text-slate-500">Cancelled by applicant · {fmtDateTime(cancelled.createdAt)}</li>}
    </ol>
  );
}
