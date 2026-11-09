"use client";
// Change your own password: current password, new password, and the new one again.
// Used on My Profile and on /change-password (which passes its own action that opens the app afterwards).
import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/password-input";
import { changePasswordAction, type PasswordState } from "@/server/profile-actions";

interface Props {
  action?: (prev: PasswordState, formData: FormData) => Promise<PasswordState>;
}

export function ChangePasswordForm({ action: serverAction = changePasswordAction }: Props) {
  // After every submit React clears the form, so no password stays on the screen.
  const [state, action, pending] = useActionState(serverAction, { error: null });

  useEffect(() => {
    if (state.message) toast.success(state.message);
  }, [state]);

  return (
    <form action={action} className="max-w-sm space-y-3">
      <PasswordInput name="current" placeholder="Current password" required autoComplete="current-password" />
      <PasswordInput name="password" placeholder="New password (at least 8 characters)" minLength={8} required autoComplete="new-password" />
      <PasswordInput name="confirm" placeholder="New password again" minLength={8} required autoComplete="new-password" />
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Change password"}
      </Button>
    </form>
  );
}
