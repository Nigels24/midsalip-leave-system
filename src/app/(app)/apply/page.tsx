// File Leave (CS Form No. 6). Server component: loads everything the form needs, converts it
// to plain data (Decimal -> number, Date -> "YYYY-MM-DD"), and hands it to the client form.
import { connection } from "next/server";
import { rolesFor } from "@/config/nav";
import { db } from "@/lib/db";
import { fromDbDate, todayInManila, toDbDate, yearOf } from "@/lib/dates";
import { formName, fullName } from "@/lib/utils";
import { requireRole } from "@/server/auth";
import { credits, getLeaveOptions } from "@/server/leave";
import { ApplyForm, type ApplicantView, type CreditsView, type LeaveOptionView } from "./apply-form";
import { FilingForPicker } from "./filing-for-picker";

const num = (value: { toString(): string }) => Number(value.toString()); // display/hint use only

// Same fields for "myself" and "on behalf"; never the password hash or the signature image.
const applicantQuery = { include: { office: true }, omit: { passwordHash: true, signature: true } } as const;

export default async function ApplyPage({ searchParams }: { searchParams: Promise<{ for?: string }> }) {
  await connection();
  const user = await requireRole(...rolesFor("/apply"));
  const { for: forId } = await searchParams;

  // Whose leave is it? Normally the user's own. Only the HRMO may pick someone else with ?for=
  // (any other role passing ?for= is ignored). fileLeave checks this again on submit.
  let applicant = user;
  let notFoundNotice = false;
  if (user.role === "HRMO" && forId && forId !== user.id) {
    const other = await db.employee.findFirst({ where: { id: forId, active: true }, ...applicantQuery });
    if (other) applicant = other;
    else notFoundNotice = true;
  }
  const onBehalf = applicant.id !== user.id;

  const today = todayInManila();
  const year = yearOf(today);
  const [options, c, holidayRows] = await Promise.all([
    getLeaveOptions(db, applicant.id, year),
    credits(db, applicant.id),
    // Holidays of this year and next, for the live day count (the server recounts on submit).
    db.holiday.findMany({ where: { date: { gte: toDbDate(`${year}-01-01`), lte: toDbDate(`${year + 1}-12-31`) } } }),
  ]);

  // The HRMO's "Filing for" list: every active employee.
  const employees =
    user.role === "HRMO"
      ? await db.employee.findMany({
          where: { active: true, id: { not: user.id } },
          select: { id: true, firstName: true, middleInitial: true, lastName: true, office: { select: { id: true } } },
          orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        })
      : [];

  const applicantView: ApplicantView = {
    id: applicant.id,
    formName: formName(applicant),
    fullName: fullName(applicant),
    position: applicant.position,
    officeName: applicant.office.name,
    isHeadOfOffice: applicant.office.headId === applicant.id,
  };
  const creditsView: CreditsView = {
    vl: num(c.vl),
    vlPending: num(c.vlPending),
    vlAvailable: num(c.vlAvailable),
    sl: num(c.sl),
    slPending: num(c.slPending),
    slAvailable: num(c.slAvailable),
  };
  const optionViews: LeaveOptionView[] = options.map((o) => ({
    code: o.type.code,
    name: o.type.name,
    legalBasis: o.type.legalBasis,
    ruleNote: o.type.ruleNote ?? "",
    deductsFrom: o.type.deductsFrom,
    detailKind: o.type.detailKind,
    convertible: o.type.convertible,
    maxDaysPerYear: o.type.maxDaysPerYear ? num(o.type.maxDaysPerYear) : null,
    usedDays: num(o.usedDays),
    remainingDays: o.remainingDays !== null ? num(o.remainingDays) : null,
    allowed: o.allowed,
    reason: o.reason,
  }));

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">File a Leave Application</h1>
        <p className="mt-1 text-sm text-slate-500">Based on Civil Service Form No. 6 (Revised 2020)</p>
      </div>

      {user.role === "HRMO" && (
        <FilingForPicker
          currentId={applicant.id}
          employees={employees.map((e) => ({ id: e.id, name: fullName(e), officeId: e.office.id }))}
        />
      )}
      {notFoundNotice && (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          That employee was not found or is deactivated. You are filing for yourself.
        </p>
      )}
      {onBehalf && (
        <p className="mb-4 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
          You are filing on behalf of <b>{applicantView.fullName}</b>. The application will record you as the person who filed it.
        </p>
      )}

      {/* key: switching the employee starts a fresh form */}
      <ApplyForm
        key={applicant.id}
        applicant={applicantView}
        onBehalf={onBehalf}
        options={optionViews}
        credits={creditsView}
        holidays={holidayRows.map((h) => fromDbDate(h.date))}
        today={today}
        year={year}
      />
    </>
  );
}
