// /change-password: a new or reset account must choose its own password before anything else.
// requireUser() (src/server/auth.ts) sends such an account here from every other page and server
// action, so this page and its action use requireSignedIn() instead. No sidebar: the user cannot
// go anywhere else yet, only change the password or sign out.
import { connection } from "next/server";
import { KeyRound, LogOut } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Seal } from "@/components/seal";
import { APP } from "@/lib/constants";
import { fullName } from "@/lib/utils";
import { logout } from "@/server/auth-actions";
import { requireSignedIn } from "@/server/auth";
import { changeRequiredPasswordAction } from "@/server/profile-actions";
import { ChangePasswordForm } from "@/app/(app)/profile/change-password-form";

export default async function ChangePasswordPage() {
  await connection();
  const user = await requireSignedIn();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center gap-3">
          <Seal className="h-14 w-14" />
          <div>
            <p className="font-semibold text-slate-900">{APP.agency}</p>
            <p className="text-xs text-muted-foreground">{APP.subtitle}</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <KeyRound size={20} /> Choose your own password
            </CardTitle>
            <CardDescription>
              {user.mustChangePassword
                ? `Welcome, ${fullName(user)}. You signed in with a temporary password. Before you continue, type it once more below and choose a new password that only you know.`
                : "Type your current password, then your new password twice."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ChangePasswordForm action={changeRequiredPasswordAction} />
            <p className="text-xs text-slate-500">At least 8 characters, and different from the current one. Do not share it with anyone.</p>
          </CardContent>
        </Card>

        <form action={logout} className="mt-4 text-center">
          <button type="submit" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-red-600">
            <LogOut size={14} /> Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
