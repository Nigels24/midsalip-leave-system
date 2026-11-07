// Printable CS Form No. 6 (Revised 2020), filled in from the database, with the verification QR code.
// Same layout and wording as the prototype's /form6 page.
// Only for APPROVED applications, and only for people who may open the application itself.
// Panel revision 7: each signee's e-signature appears on their line. It comes from the
// ApprovalAction.signature snapshot taken when they acted, never from today's Employee.signature.
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ActionStep } from "@/generated/prisma/client";
import { APP, STATUS_LABELS } from "@/lib/constants";
import { db } from "@/lib/db";
import { fmtDate, fmtDateTime, fmtNum, fmtRange, peso } from "@/lib/format";
import { CALENDAR_DAY_TYPES, type LeaveDetails } from "@/lib/leave-types";
import { formName, fullName } from "@/lib/utils";
import { canViewApplication } from "@/server/application-access";
import { requireUser } from "@/server/auth";
import { verifyQr } from "@/server/qr";
import { PrintButton } from "@/components/print-button";

const person = { select: { firstName: true, middleInitial: true, lastName: true, position: true } } as const;

export default async function Form6Page({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const user = await requireUser();
  const { id } = await params;

  const app = await db.leaveApplication.findUnique({
    where: { id },
    include: {
      // Only the fields printed on the form (never the password hash or the current signature).
      employee: {
        select: { firstName: true, middleInitial: true, lastName: true, position: true, monthlySalary: true, office: true },
      },
      leaveType: true,
      filedBy: person,
      actions: { include: { actor: person }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!app) notFound();
  if (!canViewApplication(user, app)) {
    return <Message title="No access" text="You do not have access to this application." href="/dashboard" link="Back to dashboard" />;
  }
  if (app.status !== "APPROVED") {
    return (
      <Message
        title="CS Form No. 6 is not available yet"
        text={`The printable form and its QR code are issued once the application is approved. This application is: ${STATUS_LABELS[app.status]}.`}
        href={`/applications/${app.id}`}
        link="Back to application"
      />
    );
  }

  const e = app.employee;
  const d = app.details as LeaveDetails;
  const types = await db.leaveType.findMany({ orderBy: { sortOrder: "asc" }, select: { code: true, name: true, legalBasis: true } });
  const { dataUrl: qr, url: verifyUrl } = await verifyQr(app.refNo);

  // The last action of each step (there is only one of each on an approved application).
  const act = (step: ActionStep) => app.actions.findLast((a) => a.step === step);
  const filed = act("FILED");
  const rec = act("RECOMMENDED");
  const cert = act("CERTIFIED");
  const fin = act("APPROVED");

  // Panel revision 6: when the HRMO encoded the leave, the FILED action holds the HRMO's
  // signature, not the applicant's, so the applicant's line stays blank to be signed by hand.
  const filedOnBehalf = app.filedById !== null && app.filedById !== app.employeeId;
  const dayWord = CALENDAR_DAY_TYPES.includes(app.typeCode) ? "calendar day(s)" : "day(s)";

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={`/applications/${app.id}`} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
          <ArrowLeft size={16} /> Back to application
        </Link>
        <PrintButton />
      </div>

      <div className="print-area mx-auto max-w-[210mm] overflow-hidden border border-slate-300 bg-white p-6 font-serif text-[11px] leading-snug text-black shadow-sm sm:p-8">
        <div className="flex items-start justify-between">
          <div className="text-[10px] italic">
            <p className="font-bold not-italic">Civil Service Form No. 6</p>
            <p>Revised 2020</p>
          </div>
          <div className="text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt={`QR code for ${app.refNo}`} width={84} height={84} />
            <p className="mt-0.5 font-mono text-[9px] font-bold">{app.refNo}</p>
          </div>
        </div>
        <div className="-mt-12 text-center">
          <p>Republic of the Philippines</p>
          <p className="text-[12px] font-bold">{APP.agency.toUpperCase()}</p>
          <p>{APP.province}</p>
          <h1 className="mt-4 text-lg font-bold tracking-wide">APPLICATION FOR LEAVE</h1>
        </div>

        <div className="mt-4 border border-black">
          <div className="grid grid-cols-[1fr_2fr] border-b border-black">
            <div className="border-r border-black p-1.5">
              1. OFFICE/DEPARTMENT
              <p className="font-sans font-semibold">{e.office.name}</p>
            </div>
            <div className="p-1.5">
              2. NAME : <span className="text-[9px]">(Last) (First) (Middle)</span>
              <p className="font-sans font-semibold">{formName(e)}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-1 border-b-4 border-double border-black p-1.5">
            <span>
              3. DATE OF FILING <Line>{fmtDate(app.filedAt)}</Line>
            </span>
            <span>
              4. POSITION <Line>{e.position}</Line>
            </span>
            <span>
              5. SALARY <Line>{peso(e.monthlySalary)}</Line>
            </span>
          </div>

          <p className="shade border-b border-black py-0.5 text-center font-bold">6. DETAILS OF APPLICATION</p>
          <div className="grid grid-cols-2 border-b border-black">
            <div className="border-r border-black p-1.5">
              <p className="mb-1">6.A TYPE OF LEAVE TO BE AVAILED OF</p>
              {types.map((x) => (
                <p key={x.code} className="flex text-[10px]">
                  <Box on={x.code === app.typeCode} />
                  <span>
                    <b>{x.name}</b> <span className="text-[8.5px]">({x.legalBasis})</span>
                  </span>
                </p>
              ))}
              <p className="mt-1 text-[10px]">
                Others: <Line className="min-w-32" />
              </p>
            </div>
            <div className="p-1.5 text-[10px]">
              <p className="mb-1 text-[11px]">6.B DETAILS OF LEAVE</p>
              <p className="italic">In case of Vacation/Special Privilege Leave:</p>
              <p className="flex">
                <Box on={d.location === "Within the Philippines"} /> Within the Philippines
                <Line className="ml-1 min-w-20">{d.location === "Within the Philippines" ? d.locationSpec : ""}</Line>
              </p>
              <p className="flex">
                <Box on={d.location === "Abroad"} /> Abroad (Specify)
                <Line className="ml-1 min-w-20">{d.location === "Abroad" ? d.locationSpec : ""}</Line>
              </p>
              <p className="mt-1 italic">In case of Sick Leave:</p>
              <p className="flex">
                <Box on={d.sickWhere === "In Hospital"} /> In Hospital (Specify Illness)
                <Line className="ml-1 min-w-16">{d.sickWhere === "In Hospital" ? d.illness : ""}</Line>
              </p>
              <p className="flex">
                <Box on={d.sickWhere === "Out Patient"} /> Out Patient (Specify Illness)
                <Line className="ml-1 min-w-16">{d.sickWhere === "Out Patient" ? d.illness : ""}</Line>
              </p>
              <p className="mt-1 italic">In case of Special Leave Benefits for Women:</p>
              <p>
                (Specify Illness) <Line className="min-w-32">{d.womenIllness}</Line>
              </p>
              <p className="mt-1 italic">In case of Study Leave:</p>
              <p className="flex">
                <Box on={d.study === "Completion of Master's Degree"} /> Completion of Master&apos;s Degree
              </p>
              <p className="flex">
                <Box on={d.study === "BAR/Board Examination Review"} /> BAR/Board Examination Review
              </p>
              <p className="mt-1 italic">Other purpose:</p>
              <p className="flex">
                <Box /> Monetization of Leave Credits
              </p>
              <p className="flex">
                <Box /> Terminal Leave
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 border-b-4 border-double border-black">
            <div className="border-r border-black p-1.5">
              <p>6.C NUMBER OF WORKING DAYS APPLIED FOR</p>
              <Line className="ml-4 mt-1">
                {fmtNum(app.days)} {dayWord}
              </Line>
              <p className="ml-4 mt-2">INCLUSIVE DATES</p>
              <Line className="ml-4 mt-1">{fmtRange(app.startDate, app.endDate)}</Line>
            </div>
            <div className="p-1.5">
              <p>6.D COMMUTATION</p>
              <p className="flex">
                <Box on={app.commutation === "NOT_REQUESTED"} /> Not Requested
              </p>
              <p className="flex">
                <Box on={app.commutation === "REQUESTED"} /> Requested
              </p>
              <Sig
                name={fullName(e)}
                title="(Signature of Applicant)"
                signature={filedOnBehalf ? null : filed?.signature}
                date={filedOnBehalf ? null : filed?.createdAt}
              />
              {filedOnBehalf && app.filedBy && (
                <p className="mt-0.5 text-center font-sans text-[8.5px] italic">Encoded by {fullName(app.filedBy)} on behalf of the applicant</p>
              )}
            </div>
          </div>

          <p className="shade border-b border-black py-0.5 text-center font-bold">7. DETAILS OF ACTION ON APPLICATION</p>
          <div className="grid grid-cols-2 border-b border-black">
            <div className="border-r border-black p-1.5">
              <p>7.A CERTIFICATION OF LEAVE CREDITS</p>
              <p className="text-center">
                As of <Line>{app.certAsOf ? fmtDate(app.certAsOf) : ""}</Line>
              </p>
              <table className="mt-1 w-full border border-black text-center text-[10px] [&_td]:border [&_td]:border-black [&_td]:px-1 [&_th]:border [&_th]:border-black">
                <thead>
                  <tr>
                    <th />
                    <th>Vacation Leave</th>
                    <th>Sick Leave</th>
                  </tr>
                </thead>
                <tbody className="font-sans">
                  <CertRow label="Total Earned" vl={app.certVlTotal} sl={app.certSlTotal} />
                  <CertRow label="Less this application" vl={app.certVlLess} sl={app.certSlLess} />
                  <CertRow label="Balance" vl={app.certVlBalance} sl={app.certSlBalance} bold />
                </tbody>
              </table>
              <Sig name={cert ? fullName(cert.actor) : ""} title="(Authorized Officer – HRMO)" signature={cert?.signature} date={cert?.createdAt} />
            </div>
            <div className="p-1.5">
              <p>7.B RECOMMENDATION</p>
              <p className="flex">
                <Box on={!!rec} /> For approval
              </p>
              <p className="flex">
                <Box /> For disapproval due to <Line className="ml-1 min-w-20" />
              </p>
              {/* A department head's own leave skips recommendation, so this line can be empty. */}
              <Sig
                name={rec ? fullName(rec.actor) : "—"}
                title="(Authorized Officer – Department Head)"
                signature={rec?.signature}
                date={rec?.createdAt}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 p-1.5">
            <div>
              <p>7.C APPROVED FOR:</p>
              <p className="ml-3">
                <Line className="min-w-12 text-center">{fmtNum(app.days)}</Line> days with pay
              </p>
              <p className="ml-3">
                <Line className="min-w-12 text-center">0</Line> days without pay
              </p>
              <p className="ml-3">
                <Line className="min-w-12" /> others (Specify)
              </p>
            </div>
            <div>
              <p>7.D DISAPPROVED DUE TO:</p>
              <Line className="mt-1 w-full" />
            </div>
            <div className="col-span-2 mx-auto w-72">
              <Sig name={fin ? fullName(fin.actor) : ""} title="(Authorized Official – Municipal Mayor)" signature={fin?.signature} date={fin?.createdAt} />
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-4 font-sans text-[9px] text-slate-600">
          <p>
            Generated by the {APP.name} {APP.subtitle}. To verify authenticity, scan the QR code or open{" "}
            <span className="font-mono">{verifyUrl}</span>.
          </p>
          <p className="whitespace-nowrap">Printed {fmtDateTime(new Date())}</p>
        </div>
      </div>
    </>
  );
}

/** A checkbox square, ticked when `on`. */
function Box({ on }: { on?: boolean }) {
  return (
    <span className="mr-1.5 inline-flex h-3 w-3 shrink-0 translate-y-px items-center justify-center border border-black text-[9px] leading-none">
      {on ? "✔" : ""}
    </span>
  );
}

/** A fill-in line. */
function Line({ children, className = "" }: { children?: ReactNode; className?: string }) {
  return <span className={`inline-block min-w-24 border-b border-black px-1 font-sans text-[11px] font-semibold ${className}`}>{children ?? " "}</span>;
}

/**
 * A signature line: the e-signature image (if any) sits above the printed name,
 * with the date the person acted. No signature -> the line is left blank to sign by hand.
 */
function Sig({ name, title, signature, date }: { name: string; title: string; signature?: string | null; date?: Date | null }) {
  return (
    <div className="mt-2 text-center">
      <div className="flex h-10 items-end justify-center">
        {signature && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={signature} alt={`Signature of ${name}`} className="max-h-10 max-w-[70%] object-contain" />
        )}
      </div>
      <p className="border-b border-black font-sans text-[11px] font-bold uppercase">{name || " "}</p>
      <p className="text-[10px]">{title}</p>
      {date && <p className="font-sans text-[9px]">Date: {fmtDate(date)}</p>}
    </div>
  );
}

/** One row of the 7.A table, from the certification snapshot (Decimal is formatted here, on the server). */
function CertRow({ label, vl, sl, bold }: { label: string; vl: { toString(): string } | null; sl: { toString(): string } | null; bold?: boolean }) {
  return (
    <tr>
      <td className="text-left font-serif italic">{label}</td>
      <td className={bold ? "font-bold" : ""}>{vl != null ? fmtNum(vl) : ""}</td>
      <td className={bold ? "font-bold" : ""}>{sl != null ? fmtNum(sl) : ""}</td>
    </tr>
  );
}

function Message({ title, text, href, link }: { title: string; text: string; href: string; link: string }) {
  return (
    <Card className="mx-auto max-w-md text-center">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{text}</CardDescription>
      </CardHeader>
      <CardContent>
        <Link href={href} className="text-sm font-medium text-brand-600 hover:underline">
          {link}
        </Link>
      </CardContent>
    </Card>
  );
}
