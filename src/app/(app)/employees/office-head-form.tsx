"use client";
// Change the head of one office: pick an active employee of that office and save.
import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { selectClass } from "@/components/list-controls";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { setOfficeHeadAction, type FormState } from "@/server/employee-actions";

export function OfficeHeadForm({
  officeId,
  currentHeadId,
  candidates,
}: {
  officeId: string;
  currentHeadId: string | null;
  candidates: { id: string; label: string }[];
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(setOfficeHeadAction.bind(null, officeId), { error: null });

  useEffect(() => {
    if (state.error) toast.error(state.error);
    else if (state.message) toast.success(state.message);
  }, [state]);

  if (candidates.length === 0) return <p className="text-xs text-slate-400">No active employees in this office.</p>;
  return (
    <form action={action} className="flex gap-2">
      <select name="headId" defaultValue={currentHeadId ?? ""} className={cn(selectClass, "w-64")} aria-label="New head" required>
        <option value="" disabled>
          Choose the head…
        </option>
        {candidates.map((c) => (
          <option key={c.id} value={c.id}>
            {c.label}
          </option>
        ))}
      </select>
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "Saving…" : "Set head"}
      </Button>
    </form>
  );
}
