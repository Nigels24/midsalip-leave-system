"use client";
// Deactivate / reactivate the account, unlock it after too many wrong passwords, and reset its password.
// The hints below only explain; the server (employee-rules.ts) enforces every rule.
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PasswordInput } from "@/components/password-input";
import { resetPasswordAction, setEmployeeActiveAction, unlockAccountAction, type FormState } from "@/server/employee-actions";

interface Props {
  employeeId: string;
  name: string;
  active: boolean;
  isSelf: boolean;
  heads: string | null; // name of the office they head
  openApplications: number;
  lockedUntil: string | null; // "Nov 9, 2026, 9:15 AM" while sign-in is locked, otherwise null
  mustChangePassword: boolean;
}

export function AccountPanel({ employeeId, name, active, isSelf, heads, openApplications, lockedUntil, mustChangePassword }: Props) {
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

  const unlock = () =>
    startTransition(async () => {
      const result = await unlockAccountAction(employeeId);
      if (result.error) toast.error(result.error);
      else toast.success(result.message);
    });

  return (
    <div className="space-y-6">
      {lockedUntil && (
        <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm text-amber-800">Locked after too many wrong passwords, until {lockedUntil}.</p>
          <Button variant="outline" className="w-full" onClick={unlock} disabled={pending}>
            {pending ? "Unlocking…" : "Unlock account"}
          </Button>
        </div>
      )}
      {mustChangePassword && <p className="text-xs text-slate-500">Has a temporary password: must choose a new one at the next sign-in.</p>}
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
        <PasswordInput name="password" placeholder="New temporary password (8+ characters)" minLength={8} required autoComplete="new-password" />
        <PasswordInput name="confirm" placeholder="Type it again" minLength={8} required autoComplete="new-password" />
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
