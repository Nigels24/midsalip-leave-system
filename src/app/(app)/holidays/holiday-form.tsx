"use client";
// Add one holiday. The server (holiday-rules.ts) checks the date, the name and duplicates.
// Submitted with onSubmit (not action=), so React does not clear the fields: on a refusal the
// typed values stay, and the form is reset only after a success.
import { useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addHolidayAction } from "@/server/holiday-actions";

export function HolidayForm() {
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    startTransition(async () => {
      const result = await addHolidayAction({ error: null }, formData);
      if (result.error) return setError(result.error);
      toast.success(result.message);
      form.reset();
      setError("");
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="holiday-date">Date</Label>
        <Input id="holiday-date" name="date" type="date" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="holiday-name">Name</Label>
        <Input id="holiday-name" name="name" required maxLength={100} placeholder="e.g. Independence Day" />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Adding…" : "Add holiday"}
      </Button>
    </form>
  );
}
