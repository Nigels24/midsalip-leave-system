// The sign-in check, as a plain function so prisma/verify-engine.ts can test it (scenario v).
// The login server action (src/server/auth-actions.ts) only reads the form, calls checkLogin()
// and creates the session.
//
// Rules:
//  1. An unknown username, a deactivated account and a wrong password all get the same message,
//     and all take about as long (bcrypt runs every time), so nobody can find out which usernames exist.
//  2. 5 wrong passwords in a row lock the account for 15 minutes. While it is locked even the
//     right password is refused. The lock is written to the Audit Trail (name only).
//  3. A successful sign-in sets the counter back to 0 and clears the lock.
//  4. The HRMO can unlock early (unlockAccount() or a password reset in src/server/employee-rules.ts).
// A password is never stored or logged; only its bcrypt hash is compared.
import bcrypt from "bcryptjs";
import { fullName, normalizeUsername } from "../lib/utils";
import { audit, inTransaction, type DbClient } from "./leave/shared";

export const LOGIN_ERROR = "Incorrect username or password";
export const MAX_FAILED_LOGINS = 5;
export const LOCK_MINUTES = 15;

// Compared against when there is no usable account, so that answer takes as long as a wrong password.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);

export type LoginResult = { ok: true; employeeId: string; mustChangePassword: boolean } | { ok: false; error: string };

/** "Too many attempts. Try again in 15 minutes." (rounded up, never "0 minutes"). */
export function lockedMessage(lockedUntil: Date, now: Date) {
  const minutes = Math.max(1, Math.ceil((lockedUntil.getTime() - now.getTime()) / 60_000));
  return `Too many attempts. Try again in ${minutes} ${minutes === 1 ? "minute" : "minutes"}.`;
}

/** Is the account locked at this moment? An expired lock counts as not locked. */
export function isLocked(account: { lockedUntil: Date | null }, now: Date = new Date()) {
  return account.lockedUntil !== null && account.lockedUntil > now;
}

/**
 * Checks a username and password. `now` is a parameter only so verify:engine can test an expired lock.
 * Writes: the failed-attempt counter, the lock, and the LOGIN / LOGIN_LOCKED audit rows.
 */
export async function checkLogin(client: DbClient, usernameInput: string, password: string, now: Date = new Date()): Promise<LoginResult> {
  return inTransaction(client, async (tx) => {
    const employee = await tx.employee.findUnique({
      where: { username: normalizeUsername(usernameInput) },
      select: {
        id: true, username: true, firstName: true, middleInitial: true, lastName: true,
        passwordHash: true, active: true, mustChangePassword: true, failedLoginCount: true, lockedUntil: true,
      },
    });

    // Rule 1: no account, or a deactivated one -> same work, same answer.
    if (!employee || !employee.active) {
      await bcrypt.compare(password, DUMMY_HASH);
      return { ok: false, error: LOGIN_ERROR };
    }

    // Rule 2: locked -> refused, whatever the password.
    if (employee.lockedUntil && isLocked(employee, now)) {
      return { ok: false, error: lockedMessage(employee.lockedUntil, now) };
    }

    if (!(await bcrypt.compare(password, employee.passwordHash))) {
      // After an expired lock the count starts again from zero.
      const failed = (employee.lockedUntil ? 0 : employee.failedLoginCount) + 1;
      if (failed >= MAX_FAILED_LOGINS) {
        const lockedUntil = new Date(now.getTime() + LOCK_MINUTES * 60_000);
        await tx.employee.update({ where: { id: employee.id }, data: { failedLoginCount: failed, lockedUntil } });
        await audit(tx, null, "LOGIN_LOCKED", fullName(employee)); // the name only: never the password
        return { ok: false, error: lockedMessage(lockedUntil, now) };
      }
      await tx.employee.update({ where: { id: employee.id }, data: { failedLoginCount: failed, lockedUntil: null } });
      return { ok: false, error: LOGIN_ERROR };
    }

    // Rule 3: right password -> counter back to 0, lock cleared.
    await tx.employee.update({ where: { id: employee.id }, data: { failedLoginCount: 0, lockedUntil: null } });
    await audit(tx, employee.id, "LOGIN", `${employee.username} signed in`);
    return { ok: true, employeeId: employee.id, mustChangePassword: employee.mustChangePassword };
  });
}
