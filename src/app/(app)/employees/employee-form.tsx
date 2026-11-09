"use client";
// Add / edit employee form. Plain strings only come in (no Decimal or Date objects).
// The server (src/server/employee-rules.ts) validates everything again and decides.
import { startTransition, useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import type { EmploymentStatus } from "@/generated/prisma/client";
import { selectClass } from "@/components/list-controls";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/password-input";
import { EMPLOYMENT_STATUS_LABELS, ROLE_LABELS } from "@/lib/constants";
import { CREDIT_EARNING_STATUSES } from "@/lib/leave-types";
import { createEmployeeAction, updateEmployeeAction, type FormState } from "@/server/employee-actions";

export interface EmployeeFormValues {
  employeeNo: string;
  firstName: string;
  middleInitial: string;
  lastName: string;
  sex: string;
  position: string;
  salaryGrade: string;
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
}

export function EmployeeForm({ employeeId, values, offices }: Props) {
  const isNew = !employeeId;
  const [state, action, pending] = useActionState<FormState, FormData>(
    isNew ? createEmployeeAction : updateEmployeeAction.bind(null, employeeId),
    { error: null },
  );
  const [status, setStatus] = useState(values.status);
  const earns = CREDIT_EARNING_STATUSES.includes(status as EmploymentStatus);

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
      <div className="grid grid-cols-2 gap-2">
        <Field label="Salary grade">
          <Input name="salaryGrade" type="number" min={1} max={33} defaultValue={values.salaryGrade} required />
        </Field>
        <Field label="Monthly salary (optional)">
          <Input name="monthlySalary" inputMode="decimal" defaultValue={values.monthlySalary} placeholder="0" />
        </Field>
      </div>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}
