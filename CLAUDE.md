# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Ground rules

- **The developer runs all commands that install, migrate, seed, build, or touch git.** Write the files, then list the exact commands to run. Don't run `npm install`, `npx shadcn add`, `prisma migrate`/`db seed`/`reset`, or `git init`/`commit`/`push`/`pull` yourself.
- The stack is fixed by the manuscript (Chapter 3, Table 3.2): Next.js, Prisma, PostgreSQL 16, Tailwind CSS, QR code generation, deployed on a Windows PC over the municipal LAN. (The manuscript originally specified MySQL; the owner chose PostgreSQL so the system can also be deployed on Render with a Neon database.) Don't add other technologies. Never add next-auth: auth is a custom signed-cookie session using `jose` and `bcryptjs`.
- Keep the code simple enough for a student to explain every file at the thesis defense.
- This system must reproduce the behavior of the localStorage prototype in `../midsalip-system-prototype` (business rules are in its `src/lib/engine.ts`), changed only where the panel revisions below say so.
- Local database: PostgreSQL 16 in Docker, on port 5433:
  `docker run -d --name midsalip-postgres -e POSTGRES_PASSWORD=secret -e POSTGRES_DB=midsalip_leave -p 5433:5432 postgres:16-alpine`

## Auth

- **Session:** `src/lib/session.ts`. A signed cookie `mmh-session` (JWT, HS256, `jose`) that holds only the employee id. HttpOnly, SameSite=Lax, Secure in production, expires after 8 hours. `SESSION_SECRET` (32+ characters) signs it.
- **Current user:** `getCurrentUser()` in `src/server/auth.ts` verifies the cookie and loads the employee and office from the database on every request (wrapped in React `cache`, so once per request). A deactivated or deleted account is treated as signed out immediately. It never loads `passwordHash` (or `signature`).
- **Guards:** `requireUser()` redirects to `/login`; `requireRole(...roles)` redirects a wrong role to `/dashboard`. Page roles come from `src/config/nav.ts` via `rolesFor("/path")`, so the sidebar and the page guard always agree.
- **Rule:** every protected page AND every server action calls `requireUser()` or `requireRole()` itself. `src/proxy.ts` (Next 16's name for middleware) only checks that the cookie is validly signed and redirects to `/login`. It is a first gate, not the authorization. `/login`, `/verify` and `/verify/*` are public.
- **Login/logout:** server actions in `src/server/auth-actions.ts`. Every failure returns the same "Invalid username or password". A successful login writes an AuditLog `LOGIN` row.
- Never add next-auth.

## Panel revisions

The capstone panel asked for these at the pre-oral defense. Every later step must implement them.

1. **Benefits depend on employment type.** `EmploymentStatus` is PERMANENT, CASUAL, COS (Contract of Service), JO (Job Order), ELECTIVE, COTERMINOUS. Only PERMANENT, CASUAL and COTERMINOUS earn VL/SL credits (`CREDIT_EARNING_STATUSES` in `src/lib/leave-types.ts`). A leave type can be filed only by the statuses in `LeaveType.eligibleStatuses`.
2. **Wellness Leave (WL) and Maternity Leave (ML)** are leave types (14 types in total).
3. **Days follow the allowed days for the type.** `LeaveType.maxDaysPerYear` is the yearly cap (null = limited only by the VL/SL balance, or no fixed cap). The filing form must reject more days than are left this year, and must not offer a type the employee has already used up for the year. ML and SLBW are counted in calendar days (see `ruleNote`). Sex-specific types (ML, SLBW, VAWC for women, PL for men) are checked against `Employee.sex`.
4. **Convertible vs non-convertible.** `LeaveType.convertible` is true only for VL and SL (monetization / terminal leave). Show it wherever leave types are listed.
5. **E-signatures are placed automatically.** `Employee.signature` holds a data URL of the signature image. When a signee acts on an application (recommend, certify, approve), CS Form 6 shows that person's signature on their line. The upload screen is a later step.
6. **Who files.** Employees file their own leave, and the HRMO may file on behalf of an employee. `LeaveApplication.filedById` records who encoded it (relation "FiledBy"); the applicant is still `employeeId`. Show "Filed by" on the application and in the audit log.

The defaults for (1) to (4) are in a comment block at the top of `src/lib/leave-types.ts`. Items marked "to be confirmed by HRMO" there are not settled yet.

## Prisma 7 specifics

- The client is generated into `src/generated/prisma`, which is gitignored. Import it from `src/generated/prisma/client`, not from `@prisma/client`. Regenerate it after any schema change with `npm run db:generate`, because `migrate dev` doesn't do it.
- `prisma.config.ts` holds the database URL and the seed command. Prisma doesn't read `.env` by itself, so `dotenv/config` loads it.
- The database connection goes through `@prisma/adapter-pg` in `src/lib/db.ts`, which passes `DATABASE_URL` to it as `connectionString`.
- PostgreSQL compares text case-sensitively. Store usernames through `normalizeUsername()` (`src/lib/utils.ts`) and normalize login input the same way. Search and filter boxes use `{ contains: q, mode: "insensitive" }` to match the prototype's case-insensitive search.
- Store every credit and day amount as `Decimal(7,3)`, and do the math with `Prisma.Decimal`, never JS floats.
- `@db.Date` columns: write them with `toDbDate("YYYY-MM-DD")` and read them with `fromDbDate()` (both in `src/lib/dates.ts`).
- Pages that query the database at request time call `await connection()` from `next/server`. Without it, the page would be prerendered at build time.
