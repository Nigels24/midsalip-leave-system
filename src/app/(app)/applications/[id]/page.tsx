// One leave application (replaces the prototype's /application?id=).
// Who may open it: the applicant; the HRMO and the Approving Authority (any application);
// a department head for employees of the office they head.
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ArrowLeft, CheckCircle2, FileText, QrCode } from "lucide-react";
import { Timeline } from "@/components/leave/timeline";
import { StatusBadge } from "@/components/leave/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { COMMUTATION_LABELS, isOpen, OPEN_STATUSES } from "@/lib/constants";
import { db } from "@/lib/db";
import { todayInManila } from "@/lib/dates";
import { fmtDate, fmtDateTime, fmtNum, fmtRange, pluralDays } from "@/lib/format";
import { CALENDAR_DAY_TYPES, type LeaveDetails } from "@/lib/leave-types";
import { fullName } from "@/lib/utils";
import { canViewApplication } from "@/server/application-access";
import { requireUser } from "@/server/auth";
import { balance, canAct, credits } from "@/server/leave";
import { verifyQr } from "@/server/qr";
import { ActionPanel } from "./action-panel";
import { CancelApplicationButton } from "./cancel-button";

const personName = { select: { firstName: true, middleInitial: true, lastName: true } } as const;

async function loadApplication(id: string) {
  return db.leaveApplication.findUnique({
    where: { id },
    include: {
      employee: { include: { office: true }, omit: { passwordHash: true, signature: true } },
      leaveType: true,
      filedBy: personName,
      actions: { include: { actor: personName }, orderBy: { createdAt: "asc" } },
    },
  });
}
type LoadedApplication = NonNullable<Awaited<ReturnType<typeof loadApplication>>>;

export default async function ApplicationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ filed?: string }>;
}) {
  await connection();
  const user = await requireUser();
  const { id } = await params;
  const { filed } = await searchParams;

  const app = await loadApplication(id);
  if (!app) notFound();
  if (!canViewApplication(user, app)) {
    return (
      <Card className="mx-auto max-w-md text-center">
        <CardHeader>
          <CardTitle>No access</CardTitle>
          <CardDescription>You do not have access to this application.</CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/dashboard" className="text-sm font-medium text-brand-600 hover:underline">
            Back to dashboard
          </Link>
        </CardContent>
      </Card>
    );
  }

  const e = app.employee;
  const t = app.leaveType;
  const d = app.details as LeaveDetails;
  const isApplicant = app.employeeId === user.id;
  const filedOnBehalf = app.filedById !== null && app.filedById !== app.employeeId;
  const c = user.role !== "EMPLOYEE" ? await credits(db, e.id) : null;
  const dayWord = CALENDAR_DAY_TYPES.includes(t.code) ? "Calendar days" : "Working days";

  // May this user act on the current step? Same routing rule the server uses in actOn().
  const mayAct = isOpen(app.status) && (await canAct(db, app, user.id));
  const panel = mayAct ? await actionPanelInfo(app) : null;
  // Panel revisions 7 and 8: an approved application has a printable form and a public QR code.
  const qr = app.status === "APPROVED" ? await verifyQr(app.refNo) : null;

  return (
    <>
      <Link href={mayAct ? "/approvals" : isApplicant ? "/applications" : "/records"} className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft size={16} /> Back
      </Link>

      {filed === "1" && (
        <p className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <CheckCircle2 size={16} /> Filed successfully. Reference number <b className="font-mono">{app.refNo}</b>.
        </p>
      )}

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs font-semibold text-brand-600">{app.refNo}</p>
          <h1 className="text-2xl font-bold text-slate-900">{t.name}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {fullName(e)} · {e.office.name} · filed {fmtDateTime(app.filedAt)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={app.status} />
          {isApplicant && isOpen(app.status) && (
            <CancelApplicationButton applicationId={app.id} summary={`${t.name} · ${fmtRange(app.startDate, app.endDate)}`} />
          )}
          {qr && (
            <Button asChild size="sm">
              <Link href={`/applications/${app.id}/form`}>
                <FileText size={14} /> Form 6
              </Link>
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {mayAct && panel && (
            <ActionPanel
              applicationId={app.id}
              status={app.status as "FOR_RECOMMENDATION" | "FOR_CERTIFICATION" | "FOR_APPROVAL"}
              summary={`${fullName(e)} · ${t.name} · ${pluralDays(app.days)} · ${fmtRange(app.startDate, app.endDate)}`}
              approvalNote={
                app.status === "FOR_APPROVAL" && t.deductsFrom
                  ? `${fmtNum(app.days)} day(s) will be deducted from the employee's ${t.deductsFrom} balance, and a QR code will be generated for this application.`
                  : null
              }
            >
              {panel}
            </ActionPanel>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Application details</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
                <Item k="Employee" v={`${fullName(e)} (${e.employeeNo})`} />
                <Item k="Position" v={`${e.position} · SG ${e.salaryGrade}`} />
                <Item k="Leave type" v={t.name} />
                <Item
                  k="Credit charged to"
                  v={t.deductsFrom ? (t.deductsFrom === "VL" ? "Vacation leave credits" : "Sick leave credits") : "Not charged to VL/SL"}
                />
                <Item k="Inclusive dates" v={fmtRange(app.startDate, app.endDate)} />
                <Item k={dayWord} v={fmtNum(app.days)} />
                {d.location && <Item k="Location" v={`${d.location}${d.locationSpec ? ` – ${d.locationSpec}` : ""}`} />}
                {d.sickWhere && <Item k="Sick leave" v={`${d.sickWhere}${d.illness ? ` – ${d.illness}` : ""}`} />}
                {d.womenIllness && <Item k="Illness" v={d.womenIllness} />}
                {d.study && <Item k="Study leave" v={d.study} />}
                <Item k="Commutation" v={COMMUTATION_LABELS[app.commutation]} />
                {d.others && <Item k="Remarks" v={d.others} />}
                {/* Panel revision 6: record who encoded the application. */}
                {filedOnBehalf && app.filedBy && <Item k="Filed by" v={`${fullName(app.filedBy)} on behalf of the employee`} />}
                <Item k="Legal basis" v={t.legalBasis} />
              </dl>
            </CardContent>
          </Card>

          {app.certAsOf && (
            <Card>
              <CardHeader>
                <CardTitle>Certified leave credits</CardTitle>
                <CardDescription>As of {fmtDate(app.certAsOf)}</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4 text-sm">
                <Item
                  k="VL earned / less / balance"
                  v={`${fmtNum(app.certVlTotal ?? 0)} / ${fmtNum(app.certVlLess ?? 0)} / ${fmtNum(app.certVlBalance ?? 0)}`}
                />
                <Item
                  k="SL earned / less / balance"
                  v={`${fmtNum(app.certSlTotal ?? 0)} / ${fmtNum(app.certSlLess ?? 0)} / ${fmtNum(app.certSlBalance ?? 0)}`}
                />
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Routing &amp; status</CardTitle>
            </CardHeader>
            <CardContent>
              <Timeline
                status={app.status}
                applicantIsHead={e.office.headId === e.id}
                actions={app.actions.map((a) => ({
                  id: a.id,
                  step: a.step,
                  actorName: fullName(a.actor),
                  remarks: a.remarks,
                  createdAt: a.createdAt,
                }))}
              />
            </CardContent>
          </Card>

          {qr && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <QrCode size={18} /> Verification QR code
                </CardTitle>
                <CardDescription>Anyone can scan it, without logging in, to check that this leave is authentic.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-center">
                {/* A data URL made on the server, so next/image optimization does not apply. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qr.dataUrl} alt={`QR code for ${app.refNo}`} width={160} height={160} className="mx-auto" />
                <p className="font-mono text-sm font-bold text-slate-800">{app.refNo}</p>
                <p className="break-all text-xs text-slate-500">{qr.url}</p>
                <Button asChild className="w-full">
                  <Link href={`/applications/${app.id}/form`}>
                    <FileText size={16} /> Open Form 6
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}

          {c && (
            <Card className="gap-2 p-5 text-sm">
              <p className="font-semibold text-slate-800">Applicant&apos;s current credits</p>
              <div className="space-y-1 text-slate-600">
                <p>
                  VL: <b className="tabular-nums text-slate-800">{fmtNum(c.vl)}</b> (pending {fmtNum(c.vlPending)})
                </p>
                <p>
                  SL: <b className="tabular-nums text-slate-800">{fmtNum(c.sl)}</b> (pending {fmtNum(c.slPending)})
                </p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

/**
 * Server-rendered information shown inside the action panel (read only, writes nothing):
 *  - certification: the CS Form 6 item 7.A table as of today;
 *  - recommendation: colleagues in the same office already on leave (approved or pending) on these dates.
 */
async function actionPanelInfo(app: LoadedApplication) {
  const e = app.employee;
  const t = app.leaveType;

  if (app.status === "FOR_CERTIFICATION") {
    const today = todayInManila();
    const vlTotal = await balance(db, e.id, "VL", today);
    const slTotal = await balance(db, e.id, "SL", today);
    const vlLess = t.deductsFrom === "VL" ? app.days : 0;
    const slLess = t.deductsFrom === "SL" ? app.days : 0;
    return (
      <div className="overflow-hidden rounded-lg border text-sm">
        <div className="bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          7.A Certification of leave credits · as of {fmtDate(today)}
        </div>
        <table className="w-full text-right [&_td]:px-4 [&_td]:py-2 [&_th]:px-4 [&_th]:py-2">
          <thead className="text-xs text-slate-500">
            <tr>
              <th className="text-left" />
              <th>Vacation Leave</th>
              <th>Sick Leave</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            <tr className="border-t">
              <td className="text-left text-slate-500">Total earned</td>
              <td>{fmtNum(vlTotal)}</td>
              <td>{fmtNum(slTotal)}</td>
            </tr>
            <tr className="border-t">
              <td className="text-left text-slate-500">Less this application</td>
              <td>{fmtNum(vlLess)}</td>
              <td>{fmtNum(slLess)}</td>
            </tr>
            <tr className="border-t font-semibold">
              <td className="text-left">Balance</td>
              <td>{fmtNum(vlTotal.minus(vlLess))}</td>
              <td>{fmtNum(slTotal.minus(slLess))}</td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  if (app.status === "FOR_RECOMMENDATION") {
    const colleagues = await db.leaveApplication.findMany({
      where: {
        employeeId: { not: e.id },
        employee: { officeId: e.officeId },
        status: { in: [...OPEN_STATUSES, "APPROVED"] },
        startDate: { lte: app.endDate }, // the two date ranges overlap
        endDate: { gte: app.startDate },
      },
      include: { employee: personName, leaveType: { select: { name: true } } },
      orderBy: { startDate: "asc" },
    });
    if (colleagues.length === 0) return <></>;
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <b>Heads up:</b> {colleagues.length} other staff from {e.office.name} {colleagues.length === 1 ? "is" : "are"} on approved or
        pending leave during this period:
        <ul className="mt-1 list-disc pl-5">
          {colleagues.map((a) => (
            <li key={a.id}>
              {fullName(a.employee)} · {a.leaveType.name} · {fmtRange(a.startDate, a.endDate)}
              {a.status !== "APPROVED" && " (pending)"}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return <></>; // final approval: no extra information
}

function Item({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{k}</dt>
      <dd className="mt-0.5 font-medium text-slate-800">{v}</dd>
    </div>
  );
}
