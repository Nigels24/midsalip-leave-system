"use client";
// The sign-in form. A client component because it shows the error returned by the
// login server action (useActionState) and lets demo accounts fill the fields.
import { useActionState, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import type { Role } from "@/generated/prisma/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ROLE_LABELS } from "@/lib/constants";
import { login, type LoginState } from "@/server/auth-actions";

interface Props {
  office: string;
  demo: { accounts: { username: string; name: string; role: Role }[]; password: string } | null;
}

const initialState: LoginState = { error: null };

export function LoginForm({ office, demo }: Props) {
  // state = what the action returned last time; pending = true while it runs.
  const [state, formAction, pending] = useActionState(login, initialState);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Sign in</CardTitle>
          <CardDescription>Use the account issued by the {office}.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-4">
            {state.error && (
              <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {state.error}
              </p>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                name="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                placeholder="e.g. jpepito"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {demo && (
        <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Demo accounts</p>
          <p className="mt-0.5 text-xs text-slate-500">
            Click to fill in · password <code className="rounded bg-slate-100 px-1">{demo.password}</code>
          </p>
          <div className="mt-3 max-h-64 space-y-1 overflow-y-auto pr-1">
            {demo.accounts.map((a) => (
              <button
                key={a.username}
                type="button"
                onClick={() => {
                  setUsername(a.username);
                  setPassword(demo.password);
                }}
                className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-left text-sm hover:border-brand-500 hover:bg-brand-50"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium text-slate-800">{a.name}</span>
                  <span className="block text-xs text-slate-500">{a.username}</span>
                </span>
                <span className="shrink-0 text-[11px] font-medium text-brand-700">{ROLE_LABELS[a.role]}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
