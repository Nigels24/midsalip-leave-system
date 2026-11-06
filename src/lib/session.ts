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

/** Signs the employee in: writes the session cookie. Call only from a server action. */
export async function createSession(employeeId: string) {
  const token = await signToken(employeeId);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true, // JavaScript in the browser cannot read it
    sameSite: "lax", // not sent on form posts from other sites
    secure: process.env.NODE_ENV === "production", // HTTPS only in production (the LAN dev server is plain HTTP)
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
