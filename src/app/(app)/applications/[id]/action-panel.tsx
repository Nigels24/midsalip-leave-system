"use client";
// The officer's action panel: Recommend / Certify / Approve, or Disapprove, with a confirmation
// dialog and remarks. Shown only when the server decided this user may act (canAct).
// `children` is information rendered on the server (7.A table, overlapping leave warning).
import { useState, useTransition } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { actOnApplicationAction } from "@/server/leave-actions";

type OpenStatus = "FOR_RECOMMENDATION" | "FOR_CERTIFICATION" | "FOR_APPROVAL";
type Decision = "APPROVE" | "DISAPPROVE";

// Button texts per step (CS Form 6, items 7.A to 7.D).
const STEP: Record<OpenStatus, { title: string; yes: string; done: string }> = {
  FOR_RECOMMENDATION: { title: "Recommendation", yes: "Recommend for approval", done: "Recommended for approval." },
  FOR_CERTIFICATION: { title: "Certification of leave credits", yes: "Certify leave credits", done: "Leave credits certified." },
  FOR_APPROVAL: { title: "Final action", yes: "Approve", done: "Application approved." },
};

interface Props {
  applicationId: string;
  status: OpenStatus;
  summary: string; // "Mark A. Dizon · Vacation Leave · 2 days · Dec 1 – Dec 2, 2026"
  approvalNote: string | null; // what happens on final approval (credits deducted)
  children?: React.ReactNode;
}

export function ActionPanel({ applicationId, status, summary, approvalNote, children }: Props) {
  const [decision, setDecision] = useState<Decision | null>(null);
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const step = STEP[status];
  const remarksMissing = decision === "DISAPPROVE" && remarks.trim() === "";

  const close = () => {
    if (pending) return;
    setDecision(null);
    setError("");
  };

  const confirm = () => {
    if (!decision) return;
    startTransition(async () => {
      // expectedStatus = the status on this screen, so a double click cannot act twice.
      const result = await actOnApplicationAction({ applicationId, decision, remarks, expectedStatus: status });
      if (result.error) return setError(result.error);
      toast.success(decision === "APPROVE" ? step.done : "Application disapproved.");
      setDecision(null);
      setRemarks("");
      setError("");
      // The action revalidated the pages, so this screen now shows the new status.
    });
  };

  return (
    <>
      <Card className="border-amber-300 ring-4 ring-amber-50">
        <CardHeader>
          <CardTitle>Your action: {step.title}</CardTitle>
          <CardDescription>Every action is recorded with your name, the date and time, your remarks and your e-signature.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {children}
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setDecision("APPROVE")}>
              <CheckCircle2 size={16} /> {step.yes}
            </Button>
            <Button variant="destructive" onClick={() => setDecision("DISAPPROVE")}>
              <XCircle size={16} /> Disapprove
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={decision !== null} onOpenChange={(open) => !open && close()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{decision === "APPROVE" ? step.yes : "Disapprove this application"}</DialogTitle>
            <DialogDescription>{summary}</DialogDescription>
          </DialogHeader>
          {decision === "APPROVE" && approvalNote && (
            <p className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-800">{approvalNote}</p>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="remarks">{decision === "DISAPPROVE" ? "Reason for disapproval *" : "Remarks (optional)"}</Label>
            <Textarea id="remarks" rows={3} value={remarks} onChange={(e) => setRemarks(e.target.value)} autoFocus />
          </div>
          {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={close} disabled={pending}>
              Cancel
            </Button>
            <Button variant={decision === "DISAPPROVE" ? "destructive" : "default"} onClick={confirm} disabled={pending || remarksMissing}>
              {pending ? "Saving…" : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
