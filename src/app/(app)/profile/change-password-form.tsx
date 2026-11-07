"use client";
// Change your own password: current password, new password, and the new one again.
import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { changePasswordAction } from "@/server/profile-actions";

export function ChangePasswordForm() {
  // After every submit React clears the form, so no password stays on the screen.
  const [state, action, pending] = useActionState(changePasswordAction, { error: null });

  useEffect(() => {
    if (state.message) toast.success(state.message);
  }, [state]);

  return (
    <form action={action} className="max-w-sm space-y-3">
      <Input name="current" type="password" placeholder="Current password" required autoComplete="current-password" />
      <Input name="password" type="password" placeholder="New password (at least 8 characters)" minLength={8} required autoComplete="new-password" />
      <Input name="confirm" type="password" placeholder="New password again" minLength={8} required autoComplete="new-password" />
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Change password"}
      </Button>
    </form>
  );
}
