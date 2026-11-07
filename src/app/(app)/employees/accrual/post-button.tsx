"use client";
// "Post credits" with a confirmation dialog. The server recomputes the list when posting,
// and the unique key on LedgerEntry makes a second click (or a second HRMO) add nothing.
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { postAccrualAction } from "@/server/employee-actions";

export function PostButton({ month, label, count }: { month: string; label: string; count: number }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const post = () =>
    startTransition(async () => {
      const result = await postAccrualAction(month);
      setOpen(false);
      if (result.error) toast.error(result.error);
      else toast.success(result.message);
    });

  return (
    <>
      <Button onClick={() => setOpen(true)}>Post credits for {label}</Button>
      <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Post credits for {label}?</DialogTitle>
            <DialogDescription>
              {count} employee(s) will each get 1.25 VL and 1.25 SL on their leave card and a notification. This cannot be undone from
              the system.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={post} disabled={pending}>
              {pending ? "Posting…" : "Post credits"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
