"use server";
// Login and logout. These run on the server when the login form or the sign-out button is submitted.
// The rules (same message for every failure, lockout after 5 wrong passwords) are in login-rules.ts.
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "../lib/db";
import { createSession, deleteSession } from "../lib/session";
import { checkLogin, LOGIN_ERROR } from "./login-rules";

export type LoginState = { error: string | null };

const loginSchema = z.object({
  username: z.string().trim().min(1).max(50),
  password: z.string().min(1).max(200),
});

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: LOGIN_ERROR };

  const result = await checkLogin(db, parsed.data.username, parsed.data.password);
  if (!result.ok) return { error: result.error };

  await createSession(result.employeeId);
  // A new or reset account changes its password before anything else (requireUser() enforces it too).
  redirect(result.mustChangePassword ? "/change-password" : "/dashboard"); // outside try/catch: redirect() works by throwing
}

export async function logout() {
  await deleteSession();
  redirect("/login");
}
