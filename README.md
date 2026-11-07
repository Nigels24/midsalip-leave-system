# MMH Leave: Employee Leave Management System

**Web-Based Employee Leave Management System with QR Code Integration** for the
Municipal Government of Midsalip, Province of Zamboanga del Sur.

MMH Leave replaces paper leave forms. Employees file leave online. The department head recommends it,
the HRMO certifies the leave credits, and the Municipal Mayor approves it. The approved
CS Form No. 6 prints with everyone's e-signature and a QR code that anyone can scan with a phone to
check that the document is real.

The system runs on one computer (the "server laptop") at the municipal hall. Other computers and phones
on the same Wi-Fi open it in their web browser. No internet connection is needed after installation.

---

## 1. Install these first (one time)

Install them on the server laptop, in this order. Accept the default options.

| Program | Where to get it | Notes |
|---|---|---|
| **Node.js** (LTS version, 22 or newer) | https://nodejs.org/en/download | Choose the **LTS** installer. |
| **Git** | https://git-scm.com/downloads | Used to download and update the system. |
| **Docker Desktop** | https://www.docker.com/products/docker-desktop/ | Runs the database. Restart the computer if asked. Open it once and wait until it says *Engine running*. |

To check, open a terminal and type the commands below. Each should print a version number.
On Windows, use **Command Prompt** or **PowerShell**; on a Mac, use **Terminal**.

```
node -v
git --version
docker --version
```

## 2. Get the system and set it up (one time)

1. Open a terminal and go to the folder where the system should live, for example your Documents:
   ```
   cd Documents
   ```
2. Download the system (ask the developer for the repository address):
   ```
   git clone <repository-address> midsalip-leave-system
   cd midsalip-leave-system
   ```
3. Make sure **Docker Desktop is open**, then start the database:
   ```
   docker compose up -d
   ```
4. Set everything up. This installs the parts, creates the settings file `.env`, creates the tables
   and the starting data. It takes a few minutes the first time:
   ```
   npm run setup
   ```
   At the end it prints the **first password** of the two starter accounts (`hrmo` and `mayor`).
   **Write it down.**
5. Prepare the system for daily use:
   ```
   npm run build
   ```

You can run `npm run setup` again at any time. It never deletes data and never resets a password.

## 3. Start the system every day

1. Open **Docker Desktop** (the database starts with it).
2. Open a terminal in the system folder and run:
   ```
   cd Documents/midsalip-leave-system
   npm run start:lan
   ```
3. Leave that window open while people use the system. To stop it, click the window and press **Ctrl+C**.

## 4. Open the system

- **On the server laptop:** open a browser and go to **http://localhost:3000**
- **From other computers and phones on the same Wi-Fi:** use the server laptop's address, for example
  **http://192.168.1.10:3000**. To find it:
  - Windows: open Command Prompt, type `ipconfig`, and look for **IPv4 Address** under your Wi-Fi adapter.
  - Mac: System Settings → Wi-Fi → **Details…** → IP address (or type `ipconfig getifaddr en0` in Terminal).
- **Windows firewall:** the first time you run `npm run start:lan`, Windows may ask whether to allow
  **Node.js** on networks. Tick **Private networks** and click **Allow**. Make sure the municipal Wi-Fi
  is set as a *Private* network (Settings → Network & Internet → Wi-Fi → your network).
- **Tip:** on the server laptop, open the system using its IP address too (not `localhost`), so the
  QR codes printed from it point to an address that phones can open.
- The address may change when the router restarts. Ask your IT person to give the server laptop a fixed
  (reserved) IP address in the router.

## 5. First login: what to do first

1. Sign in as **`hrmo`** with the first password from step 2.4.
2. Go to **My Profile** and **change the password**. Do the same for **`mayor`** (sign in as `mayor`).
   Then open the `.env` file in the system folder with Notepad and delete the line that starts with
   `SEED_ADMIN_PASSWORD`.
3. Go to **Employees & Accounts**:
   - Open the two starter accounts ("Starter HRMO" and "Starter Mayor") and enter the **real names**,
     sex, position, salary grade and date of appointment.
   - **Add every employee** (Add employee). Give each one a temporary password; they can change it on
     My Profile. Enter their opening VL and SL balances from the paper leave card.
   - In **Offices**, check the office names. **Add office** for any office that is missing, or
     **Rename** one. Then set the **head of each office**. Employees of an office without a head cannot
     file leave yet.
4. Go to **Holidays** and check this year's non-working holidays. **Every year**, when Malacañang
   publishes the proclamation of next year's holidays, choose next year and **Add holiday** for each
   date. Holidays are skipped when the working days of a leave are counted.
5. Ask each signee (department heads, HRMO, mayor) to set their **e-signature** on **My Profile**.
6. **Every month**, the HRMO posts the leave credits: **Employees & Accounts → Post monthly credits**,
   choose the month, check the list, and confirm. Posting the same month twice adds nothing.

## 6. Back up and restore

**Back up at least once a week** and copy the `backups` folder to a USB drive or another computer.

- **Back up** (the database must be running):
  ```
  npm run db:backup
  ```
  This creates a file like `backups/midsalip-leave-2026-11-07_08-30-00.sql`.
- **Restore** a backup. **This replaces all current data.** First stop the system (Ctrl+C), then:
  ```
  npm run db:restore
  ```
  Choose the backup from the list and type `RESTORE` to confirm. Then start the system again.

## 7. I forgot the HRMO password

If there is a second HRMO account, it can reset the password on **Employees & Accounts**. If not,
reset it on the **server computer** (the one that runs the system):

1. Make sure Docker Desktop is running. Open a **new** terminal window and go to the system folder
   (as in section 3). The system itself may keep running in its own window.
2. Type this, with the HRMO's username at the end (`hrmo` here), and press Enter:
   ```
   npm run reset-password -- hrmo
   ```
3. Type the new password (at least 8 characters) and press Enter, then type it again. **Nothing
   appears on the screen while you type**; that is normal.
4. It says *Password of ... was reset*. Sign in with the new password.

The Audit Trail records that the password was reset from the server console. The same command works
for any account. If it says *There is no account* or *deactivated*, check the username.

## 8. Update to a newer version

1. Stop the system (Ctrl+C) and make a backup: `npm run db:backup`
2. Download the update and apply it:
   ```
   git pull
   npm run setup
   npm run build
   ```
3. Start it again: `npm run start:lan`

## 9. Troubleshooting

| Problem | What to do |
|---|---|
| `docker compose up -d` says *cannot connect to the Docker daemon* | Docker Desktop is not running. Open it, wait for *Engine running*, and try again. |
| `npm run setup` says *The database did not answer* | Same as above, then run `docker compose up -d` and `npm run setup` again. |
| *Port 5433 is already allocated* (database) | Another program uses that port. In `.env`, add `POSTGRES_PORT="5434"` and change `5433` to `5434` inside `DATABASE_URL`. Then run `docker compose up -d` again. |
| *Port 3000 is already in use* (system) | The system is probably already running in another window. Close it, or restart the computer. |
| Other computers cannot open the system | Check that both are on the same Wi-Fi, use the IP address (not localhost), and allow Node.js in the Windows firewall (section 4). |
| Logged in but sent back to the login page | Make sure `.env` does not contain `COOKIE_SECURE="true"` (only for HTTPS servers). |
| An employee **forgot their password** | The HRMO opens **Employees & Accounts**, clicks the employee, types a new temporary password under **Reset password**, and tells the employee. The employee changes it on My Profile. |
| The **HRMO forgot their password** | See section 7: another HRMO resets it, or run `npm run reset-password -- <username>` on the server computer. |
| *Error connecting to the database* in the browser | Docker Desktop or the database is not running: open Docker Desktop, run `docker compose up -d`, then start the system again. |
| An employee cannot file leave: *has no department head yet* | The HRMO sets the head of that office in **Employees & Accounts → Offices**. |
| A leave counts a holiday as a working day | The holiday is missing for that year. The HRMO adds it on **Holidays**. Leave already filed keeps its day count. |

---

## For the developer

**Stack:** Next.js 16 (App Router, TypeScript), Prisma 7 with `@prisma/adapter-pg`, PostgreSQL 16 (Docker),
Tailwind CSS 4, shadcn/ui, `qrcode`, custom session (`jose` + `bcryptjs`, no next-auth), zod.
Read **CLAUDE.md** for the rules of the codebase. The full browser test plan is **docs/TEST-CHECKLIST.md**.

**Development with demo data** (password `demo123` for every demo account):

```
docker compose up -d
npm install
npm run setup:env        # then in .env: SHOW_DEMO_ACCOUNTS="true"
npm run db:deploy        # create the tables
npm run db:generate
npm run db:seed          # 16 demo employees, credits, signatures (NOT the production seed)
npm run dev              # http://localhost:3000
```

Use either the demo seed or the production seed on a database, never both: both create the
usernames `hrmo` and `mayor` (with different employee numbers), so the demo seed stops with a
"unique constraint" error on a production database and changes nothing there.
`npm run db:reset` deletes everything and loads only the demo data.

**Folders**

```
prisma/schema.prisma        database tables            prisma/migrations/   schema history
prisma/seed.ts              demo data (dev)            prisma/seed-production.ts  real install start data
prisma/seed-data.ts         offices, holidays, leave types shared by both seeds
prisma/verify-engine.ts     self-check of the rules (npm run verify:engine)
scripts/                    setup, wait-for-db, backup, restore (plain Node), reset-password (tsx); all work on Windows
src/app/                    pages ((app) = signed in, verify = public QR pages)
src/server/                 server actions, auth guards, reports, employee rules
src/server/leave/           leave rules: filing, eligibility, credits, workflow, accrual
src/lib/                    shared helpers (db client, session, dates, formatting, csv, calendar)
src/config/nav.ts           sidebar menu and the roles allowed on each page
docker-compose.yml          PostgreSQL 16 for local use
```

**npm scripts**

| Script | What it does |
|---|---|
| `setup` | Install (if needed), create `.env`, wait for the DB, generate client, `migrate deploy`, production seed |
| `setup:env` | Create `.env` from `.env.example` with random secrets (never overwrites) |
| `dev` | Development server |
| `build` | Generate the Prisma client and build for production |
| `start` | Production server on port 3000 |
| `start:lan` | Production server on port 3000, reachable from the LAN (`-H 0.0.0.0`) |
| `lint` | ESLint |
| `db:wait` | Wait until PostgreSQL accepts connections |
| `db:generate` | Regenerate the Prisma client |
| `db:migrate` | Create/apply a migration in development (`prisma migrate dev`) |
| `db:deploy` | Apply migrations without prompts (`prisma migrate deploy`), as used by setup |
| `db:seed` | Demo seed (development only) |
| `db:seed:production` | Production seed (offices, leave types, holidays, starter accounts) |
| `db:reset` | **Deletes all data**, re-creates the tables and loads the demo seed |
| `db:backup` / `db:restore` | Backup to / restore from `backups/*.sql` through `docker exec` |
| `verify:engine` | Self-check of the leave rules on the demo data (rolled back; exit code 1 on failure) |
| `reset-password` | `npm run reset-password -- <username>`: set a new password from the server console (hidden input, audit row with no actor) |

**Settings (.env)**: see `.env.example`. `COOKIE_SECURE` controls the HTTPS-only cookie (off by default
unless `APP_URL` starts with `https://`). On Render, set `APP_URL` to the https address.
