# MMH Leave: end-to-end test checklist

For the developer, before the defense and before handing over to the municipal hall.
Sections A to P use the **demo data** (see "Developer test data" below). Section Q
use a **production-style** database (no demo data), as the client gets it.
The login page never lists accounts: type the username and password yourself.

Run first, all must pass:

```
npm run lint
npm run build
npm run verify:engine        # scenarios a to w, "All checks passed." (on the demo database, see README "Running verify:engine")
```

### Developer test data (developers only, never on the municipal server)

`npm run db:reset` (or `npm run db:seed` on an empty database) loads the developer-only demo seed
`prisma/seed.ts`. Every demo account has the password **`demo123`** and does not have to change it.
Accounts used below: `jpepito`, `mdizon`, `klumbay` (employees), `treasurer` (head of MTO),
`hrmo` (HRMO, also heads HRMO), `mayor` (Approving Authority, heads MO), `psumalpong` (casual).

---

## A. Login and access (all roles)

- [ ] Wrong username or wrong password both show the same "Incorrect username or password".
- [ ] The login page shows no demo accounts, no demo password and no demo username hint.
- [ ] Username is case-insensitive (`JPepito` works).
- [ ] The eye button on the password shows and hides it, the cursor stays in the box, and clicking it does not submit the form. After a refused sign-in the username stays in its box.
- [ ] Each role sees only its own sidebar items:
  - employee: Dashboard, File Leave, My Applications, Leave Credits, Leave Calendar, Notifications, My Profile, Verify;
  - department head: also For My Action and Leave Records;
  - HRMO: everything, including Employees & Accounts, Reports and Audit Trail;
  - mayor: no File Leave or My Applications, no Employees, no Audit.
- [ ] Typing a forbidden address (e.g. `jpepito` → `/employees`, `/reports`, `/audit`, `/records`) redirects to the dashboard.
- [ ] Signed out, any page goes to `/login`; `/verify` stays public.
- [ ] Sign out works, and a deactivated account is signed out on its next click.
- [ ] Opened from another computer by the LAN IP with `npm run start:lan`: login stays (cookie not Secure on http).

## A2. Account security (lockout and forced password change)

On the demo data, with a throwaway employee the HRMO adds (e.g. username `locktest`):

- [ ] `hrmo` adds `locktest` with a temporary password. Sign in as `locktest`: you land on **Choose your own password**, with no sidebar.
- [ ] While there, typing `/dashboard`, `/apply`, `/profile` or `/` in the address bar brings you back to `/change-password`. Sign out works.
- [ ] A wrong current password, a short or mismatched new one, and the same password as the temporary one are refused. A valid change opens the dashboard; the next sign-in goes straight to the dashboard.
- [ ] Sign out and type a wrong password 4 times: "Incorrect username or password". The 5th: "Too many attempts. Try again in 15 minutes."
- [ ] While locked, the correct password is refused with the same "Too many attempts" message (the minutes count down).
- [ ] An unknown username with any password, any number of times, only ever says "Incorrect username or password".
- [ ] Audit Trail: a LOGIN LOCKED row with no actor and only the employee's name.
- [ ] `hrmo` opens `locktest` on Employees & Accounts: an amber "Locked ... until ..." box with **Unlock account**. Unlock: the box disappears, an UNLOCK ACCOUNT audit row is written, and `locktest` can sign in at once.
- [ ] Lock it again, then **Reset password** instead: it is unlocked, and the next sign-in asks for a new password again.
- [ ] Wait out a lock (15 minutes): the correct password works and the count starts again from zero.
- [ ] My Profile → Change password still works for a normal account and shows "Your password was changed."

## B. File Leave (employee, HRMO on behalf)

- [ ] As `jpepito`: VL for 2 working days. The live day count skips weekends and holidays, the credits hint shows, and submitting shows the reference number.
- [ ] Overlapping dates are refused; more days than available credits are refused.
- [ ] ML and SLBW count calendar days; a male employee doesn't see ML, a female employee doesn't see PL.
- [ ] `psumalpong` (casual) sees only the types allowed for casual employees; COS/JO employees can't use VL/SL.
- [ ] A type with a yearly cap disappears once it's used up (e.g. SPL 3 days).
- [ ] Commutation "Requested" is only possible for VL/SL.
- [ ] As `hrmo`: File Leave → file on behalf of `mdizon`. "Filed by" shows on the application and in the audit log.
- [ ] An employee of an office without a head is refused ("has no department head yet").

## C. My Applications

- [ ] The list has filters by status, type and year, and the pager keeps the filters.
- [ ] The applicant can cancel an open application (with confirmation); cancelled applications can't be acted on.

## D. Approval chain (department head → HRMO → mayor)

- [ ] `treasurer`: For My Action lists `mdizon`'s application, and the sidebar badge count matches.
- [ ] The overlap warning shows if MTO colleagues are on leave on those dates.
- [ ] Recommend → it moves to the HRMO; "Not recommended" needs remarks and closes it as disapproved.
- [ ] `hrmo`: certify, with the 7.A table showing earned/less/balance as of today.
- [ ] `mayor`: approve. The credits are deducted on the leave card, and the employee gets a notification.
- [ ] Acting twice (second tab) is refused: "already acted on".
- [ ] A department head's own leave skips recommendation; `hrmo`'s own leave too (heads HRMO).

## E. Leave Records

- [ ] `hrmo`/`mayor` see all; `treasurer` sees MTO only, with no office filter.
- [ ] Search by reference number or name ("mark dizon") works in any letter case, and the status/type/office/year filters combine.

## F. Profile and e-signature

- [ ] Draw a signature (mouse and touch), save, and the preview shows; Clear works.
- [ ] Upload PNG/JPG works; GIF/SVG are refused.
- [ ] Remove signature asks for confirmation.
- [ ] After changing a signature, older approved forms keep the old signature (snapshot).
- [ ] Change password: a wrong current password is refused, a short or mismatched new one is refused, and a valid change works for the next login.
- [ ] Each of the three password boxes has its own eye button. After a successful change all three are empty and hidden again.

## G. CS Form No. 6, QR code and phone scan

- [ ] An approved application shows the Form 6 button and the QR card; pending ones don't.
- [ ] Form 6 has all sections filled, each signee's signature above their name with the date, and the QR in the corner.
- [ ] Item 2 prints the whole name in capitals ("PEPITO, JOANNA R."), the same as the signature lines. 6.C reads "1 day" / "2 days" ("calendar days" for ML and SLBW).
- [ ] In 6.A, Wellness Leave shows its name only (no "to be confirmed by HRMO" text). File Leave and the application page still show its legal-basis note.
- [ ] Filed by the HRMO on behalf: the applicant's signature line is blank, with an "Encoded by" note.
- [ ] Print / Save as PDF fits one A4 page and one Letter page, with no sidebar or buttons.
- [ ] With the app opened by LAN IP, scan the QR with a phone that isn't logged in. You get the green "Authentic and approved" page with only the minimum details.
- [ ] `/verify/<pending ref>` is amber with the status only; disapproved/cancelled is red; an unknown reference shows "Not found".
- [ ] `/verify` with a lowercase reference that has spaces still works; each lookup adds a `VERIFY_QR` audit row.

## H. Dashboard

- [ ] Employee: greeting, Manila date, VL/SL cards, quick actions, 5 latest applications.
- [ ] `treasurer`: For My Action and MTO-only counts. `hrmo`/`mayor`: hall-wide counts and "On leave today".
- [ ] `mayor`: the "does not earn credits" note, no File Leave button.

## I. Leave Credits (leave card)

- [ ] The last row balance equals the cards and the File Leave balance.
- [ ] `hrmo`/`mayor` can search any employee; `treasurer` only MTO; `jpepito` with `?emp=<other id>` gets "No access".
- [ ] "Print leave card" prints only the ledger.

## J. Leave Calendar

- [ ] Previous/next month and Today work (December → January changes the year).
- [ ] Holidays show in red; weekends show no chips except ML/SLBW.
- [ ] `jpepito` sees their own office only, with colleagues' chips as names only and not links.
- [ ] `hrmo` can filter by office; pending leave is dashed amber.

## K. Notifications

- [ ] Unread rows are tinted, and the sidebar and bell badges show the count.
- [ ] Mark as read, Open application (marks it read) and Mark all as read all lower the badge.
- [ ] The Unread-only view and the pager work.
- [ ] A 1-day leave reads "(1 day)" and a 2-day leave "(2 days)" in the notifications; no "day/s" or "day(s)" anywhere (dashboard, File Leave warnings, error messages).

## L. Employees and Accounts (HRMO)

- [ ] Search by name or username in any letter case; office/status/role/active filters and the pager work.
- [ ] Add a Permanent employee with opening VL/SL: the leave card starts with "Opening balance".
- [ ] COS hides the opening fields.
- [ ] A duplicate username (any case) is refused, and the typed fields stay.
- [ ] Edit: the username is read only.
- [ ] Moving or deactivating an office head is refused.
- [ ] Deactivating yourself, the last HRMO or the last mayor, or an employee with open applications, is refused.
- [ ] Reactivate works.
- [ ] Reset password: the new temporary password works and nothing is shown back. Both boxes have an eye button, and they are empty and hidden again after the reset. Add employee's temporary password has one too.
- [ ] Offices: set a new head; an Employee becomes a Department Head, and waiting recommendations move to the new head.
- [ ] Add office "Office of the Municipal Agriculturist", code `mao`: it shows as `MAO` with "No head yet". A code `mto` or the name "office of the municipal treasurer" (any case) is refused.
- [ ] Add an employee to MAO and try to file leave as them: refused ("no department head yet"). Set the head, file again: it works.
- [ ] Rename MTO to code `MTO2` and a new name: the head and employees stay with it (employee list, Records and Calendar show the new name), and `treasurer` still recommends MTO leave. Rename it back.
- [ ] There is no delete or deactivate button for offices.

## L2. Holidays (HRMO)

- [ ] "Holidays" is in the sidebar for `hrmo` only; `jpepito`, `treasurer` and `mayor` opening `/holidays` go to the dashboard.
- [ ] The page opens on this year (Manila time), sorted by date, with the weekday; the year links run from the earliest holiday to two years ahead.
- [ ] Choose next year with no holidays: the empty state asks for the Malacañang proclamation.
- [ ] Add a holiday on a weekday next year: File Leave over that week counts one day less, and the Leave Calendar shows it in red.
- [ ] Adding a second holiday on the same date is refused with a clear message; an empty name is refused.
- [ ] Edit the date and name; delete it (with a confirmation). An application filed before the change keeps its day count.
- [ ] The Audit Trail shows ADD HOLIDAY, UPDATE HOLIDAY and DELETE HOLIDAY rows.

## L3. Salary Schedule (HRMO)

- [ ] "Salary Schedule" is in the sidebar for `hrmo` only, under Holidays; `jpepito`, `treasurer` and `mayor` opening `/salary-schedule` go to the dashboard.
- [ ] The grid shows SG 1 to 33 with Steps 1 to 8, SG 33 only Steps 1 and 2. Spot-check against DBM NBC No. 601 Annex A: SG 1 Step 1 = 14,634; SG 11 Step 1 = 31,705, Step 8 = 33,611; SG 15 Step 8 = 45,202; SG 33 Step 2 = 462,329.
- [ ] On a fresh database the percentage says "Not set yet: 100% is used". Save `90`: every amount for this LGU becomes 90% rounded to the peso (SG 15 Step 1: 42,178 × 0.9 = 37,960.2 → ₱37,960). `0`, `101` and `abc` are refused. Set it back to `100`.
- [ ] Click SG 15 Step 3, change it to `43,100` and save: the cell updates. `0` and `-5` are refused and the dialog keeps the typed value. Change it back to `43015`.
- [ ] Import: paste `grade,step,amount` plus `1,1,14634` and `15,3,43100` and click **Check**: "2 line(s) read: 0 new, 1 changed, 1 the same". Confirm **Import**: SG 15 Step 3 is 43,100. Import `15,3,43015` to put it back.
- [ ] Import with errors (`34,1,100`, `33,3,100`, `1,1,0`, the same grade and step twice): each line is listed with its line number and nothing is saved. Lines copied from Excel (tab-separated) are accepted.
- [ ] The Audit Trail shows SET SALARY PERCENT, UPDATE SALARY SCHEDULE and IMPORT SALARY SCHEDULE rows.
- [ ] Running `npm run db:seed:production` (or `npm run setup`) again does not undo an edited amount.

### Salary on Add / Edit employee

- [ ] Add employee, Permanent: type `43015` (or `43,015`) as monthly salary: grade SG 15 and Step 3 are filled in, with the green line "Matches SG 15, Step 3".
- [ ] Type `43100`: amber "Closest: SG 15 Step 3 (₱43,015), please confirm" with a **Use** button; grade and step change only when it is clicked. Type `14000`: amber "Below SG 1 Step 1".
- [ ] With the percentage at 90%, typing `37960` matches SG 15 Step 1.
- [ ] Choose SG 33: the Step list has only Steps 1 and 2. A step chosen earlier above 2 is cleared.
- [ ] Choose COS or Job Order: grade and step are hidden, nothing is filled in, and the saved employee has no grade. Elective: the grade is optional.
- [ ] Permanent without a grade is refused with a clear message.
- [ ] An application of an employee without a grade shows only the position (no "SG null"); with a grade and step it shows "Position · SG 15 Step 3".

## M. Monthly credits (HRMO)

- [ ] The preview lists only active Permanent, Casual and Coterminous employees appointed by that month.
- [ ] Posting adds "Earned – <month>" rows (+1.25 VL, +1.25 SL) and notifications.
- [ ] Posting the same month again: "Nothing to post". A future month (`?month=`) is refused.

## N. Reports and CSV (HRMO, mayor)

- [ ] The approved-day totals agree between "by employee", "by leave type" and "monthly".
- [ ] Filters (year, office, employment status, leave type, status) change the reports as described on the page.
- [ ] The credits summary matches each employee's leave card.
- [ ] Each Export CSV opens in Excel with "ñ" and "–" correct, names with commas in one cell, and 3 decimals.
- [ ] Print reports shows only the tables.

## O. Audit Trail (HRMO)

- [ ] Newest first, in Manila time; public QR scans show "Public (QR scan)".
- [ ] Action select, actor name search, date range and the pager work; there is no edit or delete.
- [ ] No password, hash or signature appears anywhere in the details.

## P. Backup and restore

- [ ] `npm run db:backup` creates `backups/midsalip-leave-<date>.sql`.
- [ ] Make a change (e.g. file a leave), stop the app, run `npm run db:restore`, choose the backup and type `RESTORE`. The change is gone.
- [ ] Typing anything other than `RESTORE` cancels, with nothing changed.
- [ ] `backups/` is not listed by `git status`.

## P2. Password recovery from the server console

- [ ] `npm run reset-password -- hrmo`: typing shows nothing; a password shorter than 8 characters or two different entries are refused with "Nothing was changed".
- [ ] With matching entries it prints "Password of ... was reset" (never the password); `hrmo` logs in with it and must then choose a new password, and the Audit Trail has a RESET PASSWORD row "... was reset from the server console" with no actor.
- [ ] On a locked account it also lifts the lock.
- [ ] `npm run reset-password -- nobody` and a deactivated username print a clear message and exit with an error (`echo $?` / `echo %errorlevel%` is 1). Without a username it prints the usage.
- [ ] Ctrl+C at the prompt cancels without changing anything.
- [ ] Works in Windows Command Prompt / PowerShell as well as macOS/Linux Terminal.

## Q. Fresh install test (production setup, clean clone)

Uses a second database on port **5434** so your development database is not touched.

1. In a new folder, clone the repository:
   ```
   git clone <repository-address> mmh-fresh
   cd mmh-fresh
   ```
2. Create the settings file and move it to the test port:
   ```
   npm run setup:env
   ```
   Edit `.env`:
   - change `5433` to `5434` in `DATABASE_URL`;
   - add `POSTGRES_PORT="5434"`, `POSTGRES_CONTAINER="midsalip-postgres-fresh"` and `POSTGRES_VOLUME="midsalip-pgdata-fresh"`.
3. Start the database and run the client steps from the README:
   ```
   docker compose up -d
   npm run setup
   npm run build
   ```
   (Stop your development server first, or it will hold port 3000.)
   ```
   npm run start:lan
   ```
4. Check:
   - [ ] Setup prints "Production seed complete": 7 offices (2 with a head), 14 leave types, 16 holidays, 258 salary schedule rows (percentage not set yet), 2 employees, and the starter password.
   - [ ] Running `npm run setup` again succeeds and says the starter accounts already exist.
   - [ ] Rename an office and delete one 2026 holiday, then run `npm run setup` again: the old office and the holiday do not come back.
   - [ ] The login page shows no demo accounts. `hrmo` and `mayor` log in with the printed password and are sent to **Choose your own password** before anything else.
   - [ ] Dashboard, Records, Calendar, Reports and Audit are empty but work. The audit log has a `SETUP` row.
   - [ ] Section L: rename the starter accounts, add an employee in MTO, try to file as them (refused: no head), set the MTO head, file again (works).
   - [ ] Section M: post the current month for the new employee.
   - [ ] After both starter passwords are changed, delete `SEED_ADMIN_PASSWORD` from `.env`, run `npm run setup` again: still succeeds, and nobody is asked to change the password again.
   - [ ] Section P (backup and restore) on this database.
   - [ ] From a phone on the same Wi-Fi: log in by the LAN IP, then scan a Form 6 QR while logged out.
5. Clean up:
   ```
   docker compose down -v
   ```
   This deletes only the `-fresh` container and volume named in this folder's `.env`. Then delete the `mmh-fresh` folder.
