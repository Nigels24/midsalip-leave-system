"use client";
// Cancel button with a confirmation dialog. Shown only to the applicant while the
// application is open; cancelApplication() on the server checks both again.
import { useState, useTransition } from "react";
import { Ban } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cancelApplicationAction } from "@/server/leave-actions";

export function CancelApplicationButton({ applicationId, summary }: { applicationId: string; summary: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const confirm = () => {
    startTransition(async () => {
      const result = await cancelApplicationAction(applicationId);
      if (result.error) return setError(result.error);
      setOpen(false);
      toast.success("Application cancelled.");
    });
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Ban size={14} /> Cancel
      </Button>
      <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel this application?</DialogTitle>
            <DialogDescription>{summary}. This cannot be undone.</DialogDescription>
          </DialogHeader>
          {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Keep it
            </Button>
            <Button variant="destructive" onClick={confirm} disabled={pending}>
              {pending ? "Cancelling…" : "Cancel application"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
