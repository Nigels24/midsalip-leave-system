"use client";
// The File Leave form (same sections as the prototype). It only gives LIVE HINTS (day count,
// allowance, credits); the server re-checks every rule in fileLeave() when it is submitted.
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CalendarDays, Info, Send } from "lucide-react";
import type { CreditKind, LeaveDetailKind } from "@/generated/prisma/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { COMMUTATION_LABELS } from "@/lib/constants";
import { fmtDateLong, fmtNum, fmtRange, pluralDays } from "@/lib/format";
import { CALENDAR_DAY_TYPES, countLeaveDays, LEAVE_LOCATIONS, SICK_WHERE, STUDY_PURPOSES, type LeaveDetails } from "@/lib/leave-types";
import { cn } from "@/lib/utils";
import { fileLeaveAction } from "@/server/leave-actions";

// ── Plain data from the server page (no Decimal, no Date) ────────────────────
export interface ApplicantView {
  id: string;
  formName: string;
  fullName: string;
  position: string;
  officeName: string;
  isHeadOfOffice: boolean;
}
export interface CreditsView {
  vl: number;
  vlPending: number;
  vlAvailable: number;
  sl: number;
  slPending: number;
  slAvailable: number;
}
export interface LeaveOptionView {
  code: string;
  name: string;
  legalBasis: string;
  ruleNote: string;
  deductsFrom: CreditKind | null;
  detailKind: LeaveDetailKind;
  convertible: boolean;
  maxDaysPerYear: number | null;
  usedDays: number;
  remainingDays: number | null;
  allowed: boolean;
  reason: string | null;
}

interface Props {
  applicant: ApplicantView;
  onBehalf: boolean;
  options: LeaveOptionView[];
  credits: CreditsView;
  holidays: string[];
  today: string; // "YYYY-MM-DD" in Manila
  year: number;
}

type Commutation = "NOT_REQUESTED" | "REQUESTED";

/** Fresh details when the type changes (VACATION starts with "Within the Philippines", like the prototype). */
const initialDetails = (kind: LeaveDetailKind | undefined): LeaveDetails =>
  kind === "VACATION" ? { location: LEAVE_LOCATIONS[0] } : {};

export function ApplyForm({ applicant, onBehalf, options, credits: c, holidays, today, year }: Props) {
  const router = useRouter();
  const firstAllowed = options.find((o) => o.allowed);
  const [typeCode, setTypeCode] = useState(firstAllowed?.code ?? "");
  const [details, setDetails] = useState<LeaveDetails>(initialDetails(firstAllowed?.detailKind));
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [commutation, setCommutation] = useState<Commutation>("NOT_REQUESTED");
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  const t = options.find((o) => o.code === typeCode);
  const set = (patch: Partial<LeaveDetails>) => setDetails((d) => ({ ...d, ...patch }));
  const calendarDays = CALENDAR_DAY_TYPES.includes(typeCode);
  const days = startDate && endDate && t ? countLeaveDays(typeCode, startDate, endDate, holidays) : 0;
  const available = t?.deductsFrom === "VL" ? c.vlAvailable : t?.deductsFrom === "SL" ? c.slAvailable : null;
  const route = applicant.isHeadOfOffice ? "HRMO → Approving Authority" : "Department Head → HRMO → Approving Authority";
  // Panel revision 4: commutation only for convertible types; otherwise it is always "Not Requested".
  const sentCommutation: Commutation = t?.convertible ? commutation : "NOT_REQUESTED";
  const your = onBehalf ? "The employee's" : "Your";

  const chooseType = (code: string) => {
    const next = options.find((o) => o.code === code);
    setTypeCode(code);
    setDetails((d) => ({ ...initialDetails(next?.detailKind), others: d.others }));
    setError("");
  };

  const review = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!t) return setError("Please select a leave type.");
    if (!startDate || !endDate) return setError("Please select the inclusive dates.");
    setConfirming(true);
  };

  const submit = () => {
    startTransition(async () => {
      // On success the action redirects to the new application; it only returns on an error.
      const result = await fileLeaveAction({
        employeeId: applicant.id,
        typeCode,
        startDate,
        endDate,
        commutation: sentCommutation,
        // Only filled-in text fields (an `undefined` value would fail the server's input check).
        details: Object.fromEntries(Object.entries(details).filter(([, v]) => typeof v === "string" && v.trim() !== "")),
      });
      if (result?.error) {
        setConfirming(false);
        setError(result.error);
      }
    });
  };

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-3">
        <form onSubmit={review} className="space-y-6 lg:col-span-2">
          <Section title="1–5. Applicant" description="Taken from the employee profile">
            <div className="grid gap-4 text-sm sm:grid-cols-2">
              <Info2 label="Office / Department" value={applicant.officeName} />
              <Info2 label="Name (Last, First, Middle)" value={applicant.formName} />
              <Info2 label="Position" value={applicant.position} />
              <Info2 label="Date of filing" value={fmtDateLong(today)} />
            </div>
          </Section>

          <Section title="6.A Type of leave to be availed of">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Leave type *</Label>
                <Select value={typeCode} onValueChange={chooseType}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a leave type" />
                  </SelectTrigger>
                  <SelectContent>
                    {/* Every type is listed; a type that is not allowed cannot be clicked and says why (panel revision 3). */}
                    {options.map((o) => (
                      <SelectItem key={o.code} value={o.code} disabled={!o.allowed}>
                        <span className="flex flex-col">
                          <span>{o.name}</span>
                          {!o.allowed && <span className="text-xs text-red-600">{o.reason}</span>}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!firstAllowed && <p className="text-sm text-red-600">No leave type can be filed right now.</p>}
              </div>

              {t && (
                <dl className="grid gap-3 rounded-lg bg-slate-50 p-3 text-xs sm:grid-cols-2">
                  <Fact k="Legal basis" v={t.legalBasis} />
                  <Fact k="Rule" v={t.ruleNote || "—"} />
                  <Fact
                    k={`Yearly allowance (${year})`}
                    v={
                      t.maxDaysPerYear === null
                        ? t.deductsFrom
                          ? `Limited by ${t.deductsFrom} credits`
                          : "No fixed yearly limit"
                        : `${pluralDays(t.maxDaysPerYear)} · used ${fmtNum(t.usedDays)} · remaining ${fmtNum(t.remainingDays ?? 0)}`
                    }
                  />
                  <Fact k="Convertible to cash" v={t.convertible ? "Yes (monetization / terminal leave)" : "No (non-convertible)"} />
                </dl>
              )}
              {t && !t.deductsFrom && (
                <Note tone="sky">
                  This leave type is filed, routed and QR-verified through the system but is <b>not deducted</b> from the VL/SL
                  balance. Submit the required supporting documents to the HRMO in hard copy.
                </Note>
              )}
            </div>
          </Section>

          {t && t.detailKind !== "NONE" && (
            <Section title="6.B Details of leave">
              <div className="grid gap-4 sm:grid-cols-2">
                {t.detailKind === "VACATION" && (
                  <>
                    <Field label="Where will the leave be spent? *">
                      <ChoiceSelect value={details.location} choices={LEAVE_LOCATIONS} onChange={(v) => set({ location: v })} />
                    </Field>
                    <Field label="Specify place">
                      <Input
                        value={details.locationSpec ?? ""}
                        onChange={(e) => set({ locationSpec: e.target.value })}
                        placeholder={details.location === "Abroad" ? "e.g. Singapore" : "e.g. Pagadian City"}
                      />
                    </Field>
                  </>
                )}
                {t.detailKind === "SICK" && (
                  <>
                    <Field label="In case of sick leave *">
                      <ChoiceSelect value={details.sickWhere} choices={SICK_WHERE} onChange={(v) => set({ sickWhere: v })} />
                    </Field>
                    <Field label="Specify illness *">
                      <Input value={details.illness ?? ""} onChange={(e) => set({ illness: e.target.value })} placeholder="e.g. Influenza" />
                    </Field>
                    <p className="text-xs text-slate-500 sm:col-span-2">
                      Sick leave of more than five (5) days, or filed in advance, requires a medical certificate submitted in hard
                      copy to the HRMO.
                    </p>
                  </>
                )}
                {t.detailKind === "WOMEN" && (
                  <Field label="Specify illness (Special Leave Benefits for Women) *" className="sm:col-span-2">
                    <Input value={details.womenIllness ?? ""} onChange={(e) => set({ womenIllness: e.target.value })} />
                  </Field>
                )}
                {t.detailKind === "STUDY" && (
                  <Field label="In case of study leave *" className="sm:col-span-2">
                    <ChoiceSelect value={details.study} choices={STUDY_PURPOSES} onChange={(v) => set({ study: v })} />
                  </Field>
                )}
              </div>
            </Section>
          )}

          <Section title={t?.convertible ? "6.C–6.D Inclusive dates and commutation" : "6.C Inclusive dates"}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="From *">
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    if (!endDate || endDate < e.target.value) setEndDate(e.target.value);
                  }}
                />
              </Field>
              <Field label="To *">
                <Input type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} />
              </Field>
              <div className="flex items-center gap-3 rounded-lg bg-brand-50 px-4 py-3 sm:col-span-2">
                <CalendarDays className="text-brand-600" size={20} />
                <p className="text-sm text-brand-900">
                  Number of {calendarDays ? "calendar" : "working"} days applied for: <b className="text-lg tabular-nums">{days}</b>
                  <span className="block text-xs text-brand-700">
                    {calendarDays
                      ? "This leave is counted in calendar days by law: weekends and holidays are included."
                      : "Weekends and declared holidays are excluded automatically."}
                  </span>
                </p>
              </div>
              {t?.convertible && (
                <Field label="Commutation">
                  <ChoiceSelect
                    value={commutation}
                    choices={["NOT_REQUESTED", "REQUESTED"]}
                    labels={COMMUTATION_LABELS}
                    onChange={(v) => setCommutation(v as Commutation)}
                  />
                </Field>
              )}
              <Field label="Other remarks (optional)" className={t?.convertible ? "" : "sm:col-span-2"}>
                <Textarea rows={1} className="min-h-9" value={details.others ?? ""} onChange={(e) => set({ others: e.target.value })} />
              </Field>
            </div>
          </Section>

          {error && <Note tone="red">{error}</Note>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => router.back()}>
              Cancel
            </Button>
            <Button type="submit" disabled={!t}>
              <Send size={16} /> Review &amp; submit
            </Button>
          </div>
        </form>

        <div>
          <Card className="gap-0 p-5 lg:sticky lg:top-24">
            <p className="text-sm font-semibold text-slate-800">{your} leave credits</p>
            <dl className="mt-3 space-y-2 text-sm">
              <Row k="Vacation leave balance" v={fmtNum(c.vl)} />
              <Row k="Pending VL applications" v={`− ${fmtNum(c.vlPending)}`} />
              <Row k="Available VL" v={fmtNum(c.vlAvailable)} strong />
              <div className="my-2 border-t border-slate-100" />
              <Row k="Sick leave balance" v={fmtNum(c.sl)} />
              <Row k="Pending SL applications" v={`− ${fmtNum(c.slPending)}`} />
              <Row k="Available SL" v={fmtNum(c.slAvailable)} strong />
            </dl>
            {/* Live warnings, like the prototype's red / green box. */}
            {t && available !== null && days > 0 && (
              <div className={cn("mt-4 rounded-lg px-3 py-2 text-sm", days > available ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700")}>
                {days > available
                  ? `Not enough ${t.deductsFrom} credits for ${pluralDays(days)}.`
                  : `After approval: ${pluralDays(available - days, t.deductsFrom ?? "")} left.`}
              </div>
            )}
            {t && t.remainingDays !== null && days > t.remainingDays && (
              <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {t.name} allows {pluralDays(t.maxDaysPerYear ?? 0)} a year; only {pluralDays(t.remainingDays)} left.
              </div>
            )}
            <div className="mt-5 flex gap-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
              <Info size={16} className="shrink-0 text-slate-400" />
              <p>
                Routing: <b>{route}</b>. {onBehalf ? "The employee" : "You"} will be notified in the system at every step.
              </p>
            </div>
          </Card>
        </div>
      </div>

      <Dialog open={confirming} onOpenChange={(open) => !pending && setConfirming(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit this application?</DialogTitle>
            <DialogDescription>{onBehalf ? `Filed on behalf of ${applicant.fullName}.` : "Please check the details below."}</DialogDescription>
          </DialogHeader>
          <dl className="space-y-2 text-sm">
            <Row k="Leave type" v={t?.name ?? ""} />
            <Row k="Inclusive dates" v={startDate && endDate ? fmtRange(startDate, endDate) : ""} />
            <Row k={calendarDays ? "Calendar days" : "Working days"} v={String(days)} />
            {details.location && <Row k="Location" v={`${details.location}${details.locationSpec ? ` – ${details.locationSpec}` : ""}`} />}
            {details.sickWhere && <Row k="Sick leave" v={`${details.sickWhere} – ${details.illness ?? ""}`} />}
            {details.womenIllness && <Row k="Illness" v={details.womenIllness} />}
            {details.study && <Row k="Study leave" v={details.study} />}
            <Row k="Commutation" v={COMMUTATION_LABELS[sentCommutation]} />
            <Row k="Routing" v={route} />
          </dl>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirming(false)} disabled={pending}>
              Go back
            </Button>
            <Button onClick={submit} disabled={pending}>
              <Send size={16} /> {pending ? "Submitting…" : "Submit application"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Small layout helpers used only by this form ──────────────────────────────

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

/** A shadcn Select for a fixed list of text choices. */
function ChoiceSelect({
  value,
  choices,
  labels,
  onChange,
}: {
  value: string | undefined;
  choices: string[];
  labels?: Record<string, string>;
  onChange: (value: string) => void;
}) {
  return (
    <Select value={value ?? ""} onValueChange={onChange}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Select…" />
      </SelectTrigger>
      <SelectContent>
        {choices.map((choice) => (
          <SelectItem key={choice} value={choice}>
            {labels?.[choice] ?? choice}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function Info2({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="font-medium text-slate-800">{value}</p>
    </div>
  );
}

function Fact({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-slate-500">{k}</dt>
      <dd className="font-medium text-slate-800">{v}</dd>
    </div>
  );
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-500">{k}</dt>
      <dd className={cn("text-right tabular-nums", strong ? "font-bold text-slate-900" : "text-slate-700")}>{v}</dd>
    </div>
  );
}

function Note({ tone, children }: { tone: "red" | "sky"; children: React.ReactNode }) {
  const style = tone === "red" ? "border-red-200 bg-red-50 text-red-700" : "border-sky-200 bg-sky-50 text-sky-800";
  return <div className={cn("rounded-lg border px-4 py-3 text-sm", style)}>{children}</div>;
}
