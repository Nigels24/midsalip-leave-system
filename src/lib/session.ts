// Login session = a signed cookie (JWT, HS256) that holds only the employee id.
// Signing means the browser cannot change the id without the server noticing.
// Everything else about the user (role, office, active) is read fresh from the database
// on every request, in src/server/auth.ts.
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "mmh-session";
const SESSION_HOURS = 8; // one working day

/** The secret key used to sign and check cookies. Read lazily so a missing key gives a clear error. */
function secretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET is missing or shorter than 32 characters. Set it in .env (see .env.example).");
  }
  return new TextEncoder().encode(secret);
}

/** Makes a signed token for this employee that expires in 8 hours. */
async function signToken(employeeId: string) {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(employeeId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_HOURS}h`)
    .sign(secretKey());
}

/**
 * Returns the employee id inside the token, or null if the token is missing,
 * tampered with or expired. Used by the proxy and by getCurrentUser().
 */
export async function verifyToken(token: string | undefined): Promise<string | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    return payload.sub ?? null;
  } catch {
    return null; // bad signature or expired
  }
}

/**
 * Should the cookie be "Secure" (sent over HTTPS only)? A browser never sends a Secure cookie
 * over plain http://192.168.x.x:3000, so on the municipal LAN it must be off or nobody stays logged in.
 *   COOKIE_SECURE="true" / "false" in .env decides it when set;
 *   otherwise it is on only when APP_URL starts with https:// (e.g. on Render).
 */
export function cookieSecure() {
  const setting = process.env.COOKIE_SECURE?.trim().toLowerCase();
  if (setting === "true") return true;
  if (setting === "false") return false;
  return (process.env.APP_URL ?? "").trim().toLowerCase().startsWith("https://");
}

/** Signs the employee in: writes the session cookie. Call only from a server action. */
export async function createSession(employeeId: string) {
  const token = await signToken(employeeId);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true, // JavaScript in the browser cannot read it
    sameSite: "lax", // not sent on form posts from other sites
    secure: cookieSecure(), // HTTPS-only cookie when the site runs on HTTPS (see below)
    path: "/",
    maxAge: SESSION_HOURS * 60 * 60, // seconds
  });
}

/** Signs out: removes the session cookie. Call only from a server action. */
export async function deleteSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

/** Employee id from the current request's cookie, or null. */
export async function readSession() {
  const cookieStore = await cookies();
  return verifyToken(cookieStore.get(SESSION_COOKIE)?.value);
}
