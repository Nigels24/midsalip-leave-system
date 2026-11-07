"use client";
// Deactivate / reactivate the account and reset its password.
// The hints below only explain; the server (employee-rules.ts) enforces every rule.
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { resetPasswordAction, setEmployeeActiveAction, type FormState } from "@/server/employee-actions";

interface Props {
  employeeId: string;
  name: string;
  active: boolean;
  isSelf: boolean;
  heads: string | null; // name of the office they head
  openApplications: number;
}

export function AccountPanel({ employeeId, name, active, isSelf, heads, openApplications }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const [reset, resetAction, resetting] = useActionState<FormState, FormData>(resetPasswordAction.bind(null, employeeId), { error: null });
  const resetForm = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (reset.message) {
      toast.success(reset.message);
      resetForm.current?.reset(); // the password is never shown again
    }
  }, [reset]);

  const toggle = () =>
    startTransition(async () => {
      const result = await setEmployeeActiveAction(employeeId, !active);
      setConfirming(false);
      if (result.error) toast.error(result.error);
      else toast.success(result.message);
    });

  // Why deactivation would be refused (same rules as the server), shown before trying.
  const blocker = isSelf
    ? "You cannot deactivate your own account."
    : heads
      ? `Heads the ${heads}: set another head first.`
      : openApplications > 0
        ? `Has ${openApplications} open application(s).`
        : null;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        {active ? (
          <>
            <Button variant="outline" className="w-full text-red-600" onClick={() => setConfirming(true)} disabled={pending}>
              Deactivate account
            </Button>
            {blocker && <p className="text-xs text-amber-700">{blocker}</p>}
            <p className="text-xs text-slate-500">A deactivated employee cannot sign in. Records are kept; nothing is deleted.</p>
          </>
        ) : (
          <Button className="w-full" onClick={toggle} disabled={pending}>
            {pending ? "Reactivating…" : "Reactivate account"}
          </Button>
        )}
      </div>

      <form ref={resetForm} action={resetAction} className="space-y-2 border-t pt-4">
        <p className="text-sm font-medium text-slate-700">Reset password</p>
        <Input name="password" type="password" placeholder="New temporary password (8+ characters)" minLength={8} required autoComplete="new-password" />
        <Input name="confirm" type="password" placeholder="Type it again" minLength={8} required autoComplete="new-password" />
        {reset.error && <p className="text-xs text-red-600">{reset.error}</p>}
        <Button type="submit" variant="outline" className="w-full" disabled={resetting}>
          {resetting ? "Saving…" : "Reset password"}
        </Button>
      </form>

      <Dialog open={confirming} onOpenChange={(open) => !pending && setConfirming(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate this account?</DialogTitle>
            <DialogDescription>{name} will be signed out and can no longer sign in. You can reactivate the account later.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirming(false)} disabled={pending}>
              Keep active
            </Button>
            <Button variant="destructive" onClick={toggle} disabled={pending}>
              {pending ? "Deactivating…" : "Deactivate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
