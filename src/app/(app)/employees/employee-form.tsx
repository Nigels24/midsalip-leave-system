"use client";
// Add / edit employee form. Plain strings and numbers only come in (no Decimal or Date objects).
// The server (src/server/employee-rules.ts) validates everything again and decides.
// Typing the monthly salary fills in the salary grade and step from this LGU's salary schedule
// (matchSalary() in src/lib/salary-grade.ts); the HRMO can still change them by hand.
import { startTransition, useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import type { EmploymentStatus } from "@/generated/prisma/client";
import { selectClass } from "@/components/list-controls";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/password-input";
import { EMPLOYMENT_STATUS_LABELS, ROLE_LABELS } from "@/lib/constants";
import { peso } from "@/lib/format";
import { CREDIT_EARNING_STATUSES } from "@/lib/leave-types";
import { gradeRequired, hasNoGrade, matchSalary, MAX_GRADE, maxStep, type ScheduleRow } from "@/lib/salary-grade";
import { createEmployeeAction, updateEmployeeAction, type FormState } from "@/server/employee-actions";

export interface EmployeeFormValues {
  employeeNo: string;
  firstName: string;
  middleInitial: string;
  lastName: string;
  sex: string;
  position: string;
  salaryGrade: string; // "" = none
  salaryStep: string; // "" = none
  monthlySalary: string;
  officeId: string;
  status: string;
  role: string;
  originalAppointment: string; // "YYYY-MM-DD"
  username: string;
}

interface Props {
  employeeId?: string; // set when editing
  values: EmployeeFormValues;
  offices: { id: string; name: string }[];
  schedule: ScheduleRow[]; // this LGU's amounts in whole pesos (from loadEffectiveSchedule())
}

const GRADES = Array.from({ length: MAX_GRADE }, (_, i) => i + 1);

export function EmployeeForm({ employeeId, values, offices, schedule }: Props) {
  const isNew = !employeeId;
  const [state, action, pending] = useActionState<FormState, FormData>(
    isNew ? createEmployeeAction : updateEmployeeAction.bind(null, employeeId),
    { error: null },
  );
  const [status, setStatus] = useState(values.status);
  const earns = CREDIT_EARNING_STATUSES.includes(status as EmploymentStatus);

  // Salary, grade and step. An exact match on the salary fills in the grade and step at once;
  // a closest match is only suggested, and the HRMO confirms it with the "Use" button.
  const [salary, setSalary] = useState(values.monthlySalary);
  const [grade, setGrade] = useState(values.salaryGrade);
  const [step, setStep] = useState(values.salaryStep);
  const noGrade = hasNoGrade(status); // COS and JO: no grade and no step
  const match = noGrade ? ({ kind: "none" } as const) : matchSalary(salary, schedule);

  const applyGradeStep = (g: number, s: number) => {
    setGrade(String(g));
    setStep(String(s));
  };
  const changeSalary = (value: string) => {
    setSalary(value);
    const found = matchSalary(value, schedule);
    if (!noGrade && found.kind === "exact") applyGradeStep(found.grade, found.step);
  };
  const changeGrade = (value: string) => {
    setGrade(value);
    if (!value || Number(step) > maxStep(Number(value))) setStep(""); // e.g. SG 33 has only 2 steps
  };

  useEffect(() => {
    if (state.message) toast.success(state.message);
  }, [state]);

  return (
    <form
      // onSubmit instead of action={...}: React resets a form after an action, which would wipe
      // what the HRMO typed when the server refuses (e.g. a username already taken).
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        startTransition(() => action(formData));
      }}
      className="grid gap-4 sm:grid-cols-2"
    >
      <Field label="Employee ID No.">
        <Input name="employeeNo" defaultValue={values.employeeNo} required maxLength={30} />
      </Field>
      <Field label="Sex">
        <select name="sex" defaultValue={values.sex} className={selectClass} required>
          <option value="FEMALE">Female</option>
          <option value="MALE">Male</option>
        </select>
      </Field>
      <Field label="First name">
        <Input name="firstName" defaultValue={values.firstName} required maxLength={60} />
      </Field>
      <div className="grid grid-cols-3 gap-2">
        <Field label="M.I.">
          <Input name="middleInitial" defaultValue={values.middleInitial} maxLength={3} />
        </Field>
        <div className="col-span-2">
          <Field label="Last name">
            <Input name="lastName" defaultValue={values.lastName} required maxLength={60} />
          </Field>
        </div>
      </div>
      <Field label="Position">
        <Input name="position" defaultValue={values.position} required maxLength={100} />
      </Field>
      <Field label="Office">
        <select name="officeId" defaultValue={values.officeId} className={selectClass} required>
          {offices.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Employment status">
        <select name="status" value={status} onChange={(e) => setStatus(e.target.value)} className={selectClass} required>
          {Object.entries(EMPLOYMENT_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Date of original appointment">
        <Input name="originalAppointment" type="date" defaultValue={values.originalAppointment} required />
      </Field>
      <Field label="Monthly salary (optional)">
        <Input name="monthlySalary" inputMode="decimal" value={salary} onChange={(e) => changeSalary(e.target.value)} placeholder="e.g. 43015" />
      </Field>
      {noGrade ? (
        <p className="self-end pb-2 text-xs text-slate-500">
          {EMPLOYMENT_STATUS_LABELS[status as EmploymentStatus]} workers are paid by contract, so they have no salary grade or step.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <Field label={gradeRequired(status) ? "Salary grade" : "Salary grade (optional)"}>
            <select name="salaryGrade" value={grade} onChange={(e) => changeGrade(e.target.value)} className={selectClass} required={gradeRequired(status)}>
              <option value="">—</option>
              {GRADES.map((g) => (
                <option key={g} value={g}>
                  SG {g}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Step">
            <select name="salaryStep" value={step} onChange={(e) => setStep(e.target.value)} className={selectClass} disabled={!grade}>
              <option value="">—</option>
              {Array.from({ length: grade ? maxStep(Number(grade)) : 8 }, (_, i) => i + 1).map((s) => (
                <option key={s} value={s}>
                  Step {s}
                </option>
              ))}
            </select>
          </Field>
        </div>
      )}
      <SalaryHint match={match} onUse={applyGradeStep} />
      {!noGrade && schedule.length === 0 && (
        <p className="-mt-2 text-xs text-slate-500 sm:col-span-2">
          The salary schedule is empty, so the grade and step are not filled in. Load it on the Salary Schedule page.
        </p>
      )}
      <Field label="System role">
        <select name="role" defaultValue={values.role} className={selectClass} required>
          {Object.entries(ROLE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Username">
        {isNew ? (
          <Input name="username" defaultValue={values.username} required maxLength={30} autoComplete="off" />
        ) : (
          // Read only after creation (it is how the employee signs in).
          <Input value={values.username} readOnly disabled className="font-mono" />
        )}
      </Field>

      {isNew && (
        <>
          <Field label="Temporary password (at least 8 characters)">
            <PasswordInput name="password" minLength={8} required autoComplete="new-password" />
          </Field>
          <div />
          {earns ? (
            <>
              <Field label="Opening VL balance (from the paper leave card)">
                <Input name="openingVL" inputMode="decimal" placeholder="0.000" />
              </Field>
              <Field label="Opening SL balance (from the paper leave card)">
                <Input name="openingSL" inputMode="decimal" placeholder="0.000" />
              </Field>
            </>
          ) : (
            <p className="text-xs text-slate-500 sm:col-span-2">
              {EMPLOYMENT_STATUS_LABELS[status as EmploymentStatus]} employees do not earn VL/SL credits, so there is no opening balance.
            </p>
          )}
        </>
      )}
      {!isNew && (
        <p className="text-xs text-slate-500 sm:col-span-2">
          Changing the employment status or sex only affects leave filed from now on; applications already filed are not changed.
        </p>
      )}

      {state.error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 sm:col-span-2">{state.error}</p>
      )}
      <div className="flex justify-end sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : isNew ? "Add employee" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}

/** The line under the salary: green for an exact match, amber for a suggestion to confirm. */
function SalaryHint({ match, onUse }: { match: ReturnType<typeof matchSalary>; onUse: (grade: number, step: number) => void }) {
  if (match.kind === "exact") {
    return (
      <p className="-mt-2 text-xs text-emerald-700 sm:col-span-2">
        Matches SG {match.grade}, Step {match.step}
      </p>
    );
  }
  if (match.kind === "closest") {
    return (
      <p className="-mt-2 flex flex-wrap items-center gap-2 text-xs text-amber-700 sm:col-span-2">
        Closest: SG {match.grade} Step {match.step} ({peso(match.amount)}), please confirm.
        <Button type="button" variant="outline" size="sm" className="h-6 px-2 text-xs" onClick={() => onUse(match.grade, match.step)}>
          Use SG {match.grade} Step {match.step}
        </Button>
      </p>
    );
  }
  if (match.kind === "below") {
    return (
      <p className="-mt-2 text-xs text-amber-700 sm:col-span-2">
        Below SG 1 Step 1 ({peso(match.lowest)}) of the salary schedule. Choose the grade and step by hand.
      </p>
    );
  }
  return null;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}
