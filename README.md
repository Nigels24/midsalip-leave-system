# MMH Leave — Employee Leave Management System

Web-Based Employee Leave Management System with QR Code Integration for Midsalip Municipal Hall
(Municipal Government of Midsalip, Province of Zamboanga del Sur).

Stack: Next.js (App Router, TypeScript) · Prisma ORM · PostgreSQL 16 · Tailwind CSS · shadcn/ui · QR code generation.
Runs on a Windows PC over the municipal LAN, or online on Render with a Neon PostgreSQL database.

## Prerequisites

- **Node.js** LTS (20.19 or newer)
- **PostgreSQL 16** running in **Docker** (see step 4). A native PostgreSQL 16 install also works.
  In production, a **Neon** database works too.

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Add the shadcn/ui components
npx shadcn@latest add button input label card table badge dialog select textarea sonner

# 3. Configure the environment
cp .env.example .env          # Windows: copy .env.example .env
#    then edit DATABASE_URL (user, password, database) and SESSION_SECRET

# 4. Start PostgreSQL 16 with the database "midsalip_leave" already created.
#    With Docker (matches the DATABASE_URL in .env.example):
#    The database listens on port 5433 on this PC, so it does not clash with another PostgreSQL on 5432.
docker run -d --name midsalip-postgres -e POSTGRES_PASSWORD=secret -e POSTGRES_DB=midsalip_leave \
  -p 5433:5432 -v midsalip-pgdata:/var/lib/postgresql/data postgres:16-alpine
#    Later: docker start midsalip-postgres
#    With a native install instead, run in psql:  CREATE DATABASE midsalip_leave;

# 5. Create the tables, generate the Prisma client, load the demo data
npm run db:migrate -- --name init
npm run db:generate
npm run db:seed

# 6. Run
npm run dev                   # http://localhost:3000
```

The seed can be run again at any time. It never creates duplicate rows.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Generates the Prisma client, then builds for production |
| `npm start` | Production server on port 3000, reachable from the LAN (`http://<pc-ip>:3000`) |
| `npm run lint` | ESLint |
| `npm run db:migrate` | Applies schema changes to the database (`prisma migrate dev`) |
| `npm run db:generate` | Regenerates the Prisma client after a schema change |
| `npm run db:seed` | Loads offices, employees, leave types, holidays and opening leave credits |
| `npm run db:reset` | **Deletes all data**, re-creates the tables and seeds again |
| `npm run verify:engine` | Self-check of the leave rules against the seeded data (changes are rolled back; exit code 1 if any check fails) |

## Demo accounts

All demo accounts use the password **`demo123`**. The login page lists them when `SHOW_DEMO_ACCOUNTS="true"` is in `.env`; set it to `"false"` on the real server.

| Username | Role |
|---|---|
| `mayor` | Approving Authority |
| `hrmo` | HRMO (system administrator) |
| `treasurer` | Department Head (Treasurer's Office) |
| `accountant` | Department Head (Accountant's Office) |
| `engineer` | Department Head (Engineering Office) |
| `mswdo` | Department Head (MSWDO) |
| `mho` | Department Head (Health Office) |
| `jpepito` | Employee (HRMO) |
| `mdizon` | Employee (Treasurer's Office) |
| `klumbay` | Employee (Accountant's Office) |
| `rtampus` | Employee (Engineering Office) |
| `abacus` | Employee (MSWDO) |
| `lcabahug` | Employee (Health Office) |
| `jomandam` | Employee (Health Office) |
| `cgalarrita` | Employee (Mayor's Office) |
| `psumalpong` | Employee (Engineering Office, casual) |

## Project layout

```
prisma/schema.prisma   database tables
prisma/seed.ts         demo data
prisma.config.ts       Prisma settings (database URL, seed command)
src/lib/               shared helpers: database client, session cookie, constants, leave types, dates, reference numbers
src/config/            sidebar menu per role, demo account list
src/proxy.ts           first login gate (Next.js 16 "proxy", formerly middleware)
src/server/            server actions and services (auth, guards)
src/server/leave/      leave rules: credits, eligibility, filing, approval workflow, cancel
prisma/verify-engine.ts  self-check of the leave rules (npm run verify:engine)
src/app/               pages
```
