"use server";
// Login and logout. These run on the server when the login form or the sign-out button is submitted.
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "../lib/db";
import { createSession, deleteSession } from "../lib/session";
import { normalizeUsername } from "../lib/utils";

export type LoginState = { error: string | null };

// One message for every failure, so nobody can find out which usernames exist.
const GENERIC_ERROR = "Invalid username or password";

const loginSchema = z.object({
  username: z.string().trim().min(1).max(50),
  password: z.string().min(1).max(200),
});

// Compared against when the username does not exist, so a wrong username
// takes as long as a wrong password (the response time reveals nothing).
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: GENERIC_ERROR };

  const username = normalizeUsername(parsed.data.username);
  const employee = await db.employee.findUnique({
    where: { username },
    select: { id: true, username: true, passwordHash: true, active: true },
  });

  const passwordOk = await bcrypt.compare(parsed.data.password, employee?.passwordHash ?? DUMMY_HASH);
  if (!employee || !passwordOk || !employee.active) return { error: GENERIC_ERROR };

  await db.auditLog.create({
    data: { actorId: employee.id, action: "LOGIN", detail: `${employee.username} signed in` },
  });
  await createSession(employee.id);
  redirect("/dashboard"); // must be outside try/catch: redirect() works by throwing
}

export async function logout() {
  await deleteSession();
  redirect("/login");
}
