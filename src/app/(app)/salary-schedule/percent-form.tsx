"use client";
// The LGU percentage (1 to 100). The server (salary-rules.ts) checks it and writes the audit row.
// Submitted with onSubmit (not action=), so a refused value stays in the box.
import { useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setSalaryPercentAction } from "@/server/salary-actions";

export function PercentForm({ percent, isSet }: { percent: string; isSet: boolean }) {
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await setSalaryPercentAction({ error: null }, formData);
      if (result.error) return setError(result.error);
      toast.success(result.message);
      setError("");
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="salary-percent">Percentage of the national schedule</Label>
        <div className="flex items-center gap-2">
          <Input id="salary-percent" name="percent" type="number" min={1} max={100} step="0.01" defaultValue={percent} required className="w-32" />
          <span className="text-sm text-slate-600">%</span>
        </div>
        {!isSet && <p className="text-xs text-amber-700">Not set yet: 100% is used. Save this municipality&apos;s percentage first.</p>}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Saving…" : "Save"}
      </Button>
      <p className="text-xs text-slate-500">
        Saving changes the amounts used for employees added or edited from now on. Salaries already saved on employee records
        are not changed.
      </p>
    </form>
  );
}
