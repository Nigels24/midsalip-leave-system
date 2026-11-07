// Authenticity page (public, no login): the QR code on CS Form No. 6 opens this page.
// Panel revision 8. What it may show is decided by publicVerifyResult() in src/lib/verify.ts:
//   approved      -> green "Authentic and approved" with the minimum details;
//   not approved  -> amber (still pending) or red (disapproved / cancelled) with the status only;
//   unknown       -> neutral "Not found".
// Salary, leave details, remarks and credits are never loaded here.
import { connection } from "next/server";
import { AlertTriangle, CheckCircle2, Clock, SearchX, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { isOpen, STATUS_LABELS } from "@/lib/constants";
import { db } from "@/lib/db";
import { fmtDateTime, fmtNum, fmtRange } from "@/lib/format";
import { fullName } from "@/lib/utils";
import { normalizeRefNo, publicVerifyResult, type VerifyRecord } from "@/lib/verify";
import { VerifyForm } from "../verify-form";
import { VerifyFrame } from "../verify-frame";

const person = { select: { firstName: true, middleInitial: true, lastName: true, position: true } } as const;

/** Loads only the fields the public result can contain, or null when the reference does not exist. */
async function loadRecord(refNo: string): Promise<VerifyRecord | null> {
  if (refNo.length > 40) return null; // longer than any real reference number
  const app = await db.leaveApplication.findUnique({
    where: { refNo },
    select: {
      refNo: true,
      status: true,
      startDate: true,
      endDate: true,
      days: true,
      employee: { select: { firstName: true, middleInitial: true, lastName: true, office: { select: { name: true } } } },
      leaveType: { select: { name: true } },
      actions: { select: { step: true, createdAt: true, actor: person }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!app) return null;
  const approved = app.actions.findLast((a) => a.step === "APPROVED");
  return {
    refNo: app.refNo,
    status: app.status,
    employeeName: fullName(app.employee),
    officeName: app.employee.office.name,
    leaveTypeName: app.leaveType.name,
    dates: fmtRange(app.startDate, app.endDate),
    days: fmtNum(app.days),
    approvedAt: approved ? fmtDateTime(approved.createdAt) : null,
    officers: app.actions.map((a) => ({ step: a.step, name: fullName(a.actor), position: a.actor.position })),
  };
}

export default async function VerifyResultPage({ params }: { params: Promise<{ refNo: string }> }) {
  await connection();
  const refNo = normalizeRefNo((await params).refNo);
  const record = await loadRecord(refNo);
  const result = publicVerifyResult(refNo, record);

  // Every lookup of an existing reference is logged. Nobody is logged in, so actorId is null.
  if (record) {
    await db.auditLog.create({
      data: { actorId: null, action: "VERIFY_QR", detail: `Public verification of ${record.refNo} (${STATUS_LABELS[record.status]})` },
    });
  }

  return (
    <VerifyFrame>
      <Card className="gap-0 overflow-hidden p-0">
        {result.kind === "NOT_FOUND" && (
          <div className="p-6 text-center">
            <SearchX className="mx-auto text-slate-400" size={48} />
            <p className="mt-3 text-lg font-bold text-slate-800">Not found</p>
            <p className="mt-1 text-sm text-slate-600">
              There is no leave application with reference no. <b className="break-all font-mono">{result.refNo}</b>. Check the number
              and try again. A document whose number is not found was not issued through this system.
            </p>
          </div>
        )}

        {result.kind === "NOT_APPROVED" && (
          <Banner
            tone={isOpen(result.status) ? "amber" : "red"}
            icon={isOpen(result.status) ? <Clock size={40} /> : <AlertTriangle size={40} />}
            title={isOpen(result.status) ? "Not yet approved" : `Not valid: ${STATUS_LABELS[result.status]}`}
            text={`Reference no. ${result.refNo} has no final approval (status: ${STATUS_LABELS[result.status]}). Do not honor it as an approved leave.`}
          />
        )}

        {result.kind === "AUTHENTIC" && (
          <>
            <Banner
              tone="green"
              icon={<ShieldCheck size={40} />}
              title="Authentic and approved"
              text={result.approvedAt ? `Approved ${result.approvedAt}` : "Approved"}
            />
            <dl className="divide-y divide-slate-100 text-sm">
              <Row k="Reference no." v={<span className="font-mono">{result.refNo}</span>} />
              <Row k="Employee" v={result.employeeName} />
              <Row k="Office" v={result.officeName} />
              <Row k="Type of leave" v={result.leaveTypeName} />
              <Row k="Inclusive dates" v={result.dates} />
              <Row k="Number of days" v={result.days} />
              {result.officers.map((o) => (
                <Row
                  key={o.label}
                  k={o.label}
                  v={
                    <>
                      {o.name}
                      <span className="block text-xs font-normal text-slate-500">{o.position}</span>
                    </>
                  }
                />
              ))}
            </dl>
            <p className="flex items-start gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3 text-xs text-slate-600">
              <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-600" />
              Compare these details with the printed form. Any difference means the paper was changed after approval.
            </p>
          </>
        )}
      </Card>

      <Card className="p-5">
        <VerifyForm />
      </Card>
    </VerifyFrame>
  );
}

const TONES = { green: "bg-emerald-600", amber: "bg-amber-500", red: "bg-red-600" };

function Banner({ tone, icon, title, text }: { tone: keyof typeof TONES; icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className={`${TONES[tone]} flex items-center gap-3 p-5 text-white`}>
      <span className="shrink-0">{icon}</span>
      <div>
        <p className="text-lg font-bold">{title}</p>
        <p className="text-sm opacity-90">{text}</p>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 px-5 py-3">
      <dt className="shrink-0 text-slate-500">{k}</dt>
      <dd className="text-right font-semibold text-slate-900">{v}</dd>
    </div>
  );
}
