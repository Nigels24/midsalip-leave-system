# MMH Leave: end-to-end test checklist

For the developer, before the defense and before handing over to the municipal hall.
Sections A to P use the **demo data** (`npm run db:reset`, or `npm run db:seed` on an empty database),
`SHOW_DEMO_ACCOUNTS="true"` in `.env`, and the password **`demo123`** for every account.
Section Q is the fresh install test with the **production** setup.

Run first, all must pass:

```
npm run lint
npm run build
npm run verify:engine        # scenarios a to t, "All checks passed."
```

Demo accounts used below: `jpepito`, `mdizon`, `klumbay` (employees), `treasurer` (head of MTO),
`hrmo` (HRMO, also heads HRMO), `mayor` (Approving Authority, heads MO), `psumalpong` (casual).

---

## A. Login and access (all roles)

- [ ] Wrong username or wrong password both show the same "Invalid username or password".
- [ ] Username is case-insensitive (`JPepito` works).
- [ ] Each role sees only its own sidebar items:
  - employee: Dashboard, File Leave, My Applications, Leave Credits, Leave Calendar, Notifications, My Profile, Verify;
  - department head: also For My Action and Leave Records;
  - HRMO: everything, including Employees & Accounts, Reports and Audit Trail;
  - mayor: no File Leave or My Applications, no Employees, no Audit.
- [ ] Typing a forbidden address (e.g. `jpepito` → `/employees`, `/reports`, `/audit`, `/records`) redirects to the dashboard.
- [ ] Signed out, any page goes to `/login`; `/verify` stays public.
- [ ] Sign out works, and a deactivated account is signed out on its next click.
- [ ] Opened from another computer by the LAN IP with `npm run start:lan`: login stays (cookie not Secure on http).

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

## G. CS Form No. 6, QR code and phone scan

- [ ] An approved application shows the Form 6 button and the QR card; pending ones don't.
- [ ] Form 6 has all sections filled, each signee's signature above their name with the date, and the QR in the corner.
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

## L. Employees and Accounts (HRMO)

- [ ] Search by name or username in any letter case; office/status/role/active filters and the pager work.
- [ ] Add a Permanent employee with opening VL/SL: the leave card starts with "Opening balance".
- [ ] COS hides the opening fields.
- [ ] A duplicate username (any case) is refused, and the typed fields stay.
- [ ] Edit: the username is read only.
- [ ] Moving or deactivating an office head is refused.
- [ ] Deactivating yourself, the last HRMO or the last mayor, or an employee with open applications, is refused.
- [ ] Reactivate works.
- [ ] Reset password: the new temporary password works and nothing is shown back.
- [ ] Office heads: set a new head; an Employee becomes a Department Head, and waiting recommendations move to the new head.

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
   - [ ] Setup prints "Production seed complete": 7 offices (2 with a head), 14 leave types, 16 holidays, 2 employees, and the starter password.
   - [ ] Running `npm run setup` again succeeds and says the starter accounts already exist.
   - [ ] The login page shows no demo accounts. `hrmo` and `mayor` log in with the printed password.
   - [ ] Dashboard, Records, Calendar, Reports and Audit are empty but work. The audit log has a `SETUP` row.
   - [ ] Section L: rename the starter accounts, add an employee in MTO, try to file as them (refused: no head), set the MTO head, file again (works).
   - [ ] Section M: post the current month for the new employee.
   - [ ] Change both starter passwords, delete `SEED_ADMIN_PASSWORD` from `.env`, run `npm run setup` again: still succeeds.
   - [ ] Section P (backup and restore) on this database.
   - [ ] From a phone on the same Wi-Fi: log in by the LAN IP, then scan a Form 6 QR while logged out.
5. Clean up:
   ```
   docker compose down -v
   ```
   This deletes only the `-fresh` container and volume named in this folder's `.env`. Then delete the `mmh-fresh` folder.
