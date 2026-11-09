// Who is logged in, and guards for pages and server actions.
// This file is NOT a "use server" file on purpose: its functions are only called
// from server code, never from the browser.
import { cache } from "react";
import { redirect } from "next/navigation";
import type { Role } from "../generated/prisma/client";
import { db } from "../lib/db";
import { readSession } from "../lib/session";

/**
 * The logged-in employee (with office), or null.
 * Loaded from the database on every request, so a role change or a deactivated
 * account takes effect immediately, even if the cookie is still valid.
 * cache() makes it run once per request even when the layout and the page both call it.
 */
export const getCurrentUser = cache(async () => {
  const employeeId = await readSession();
  if (!employeeId) return null;

  const user = await db.employee.findUnique({
    where: { id: employeeId },
    include: { office: true },
    // Never load the password hash; the signature image is large and not needed here,
    // and the sign-in counters belong to login-rules.ts only.
    omit: { passwordHash: true, signature: true, failedLoginCount: true, lockedUntil: true },
  });
  if (!user || !user.active) return null;
  return user;
});

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

/**
 * Use at the top of every protected page and server action. Sends visitors to /login.
 * While the account must change its password (new or reset account), every page and every
 * server action that calls this goes to /change-password instead, so nothing else can run.
 */
export async function requireUser(): Promise<CurrentUser> {
  const user = await requireSignedIn();
  if (user.mustChangePassword) redirect("/change-password");
  return user;
}

/**
 * Signed in, even if the password must still be changed. ONLY for the /change-password page
 * and its server action; everything else uses requireUser() or requireRole().
 */
export async function requireSignedIn(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Like requireUser(), but also checks the role. A wrong role goes back to /dashboard. */
export async function requireRole(...roles: Role[]): Promise<CurrentUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) redirect("/dashboard");
  return user;
}
