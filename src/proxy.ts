// Proxy (called "middleware" before Next.js 16). Runs before every matched request.
// It is only a FIRST gate: it checks that the session cookie is validly signed, without
// touching the database. Every protected page and server action must still call
// requireUser() or requireRole() itself (src/server/auth.ts), which checks the database.
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifyToken } from "./lib/session";

/** Pages anyone may open. /verify must stay public: the QR code on a printed form opens it. */
function isPublic(pathname: string) {
  return pathname === "/login" || pathname === "/verify" || pathname.startsWith("/verify/");
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  const employeeId = await verifyToken(request.cookies.get(SESSION_COOKIE)?.value);
  if (!employeeId) return NextResponse.redirect(new URL("/login", request.url));

  return NextResponse.next();
}

// Skip Next.js internals and static files (images, the seal logo, favicon).
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webp)$).*)"],
};
