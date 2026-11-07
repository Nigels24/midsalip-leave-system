"use client";
// Add an office, or rename one (name and short code). The server (office-rules.ts) checks
// that the code and the name are not used by another office, in any letter case.
// Same pattern as the other dialogs (cancel-button.tsx, post-button.tsx): the submit handler calls
// the action in a transition and closes the dialog itself on success. The form is submitted with
// onSubmit (not action=), so React does not clear the fields: on a refusal the typed values stay.
import { useState, useTransition, type FormEvent } from "react";
import { Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createOfficeAction, updateOfficeAction } from "@/server/employee-actions";

function OfficeFields({ code = "", name = "", idPrefix }: { code?: string; name?: string; idPrefix: string }) {
  return (
    <>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-code`}>Short code</Label>
        <Input id={`${idPrefix}-code`} name="code" defaultValue={code} required maxLength={16} placeholder="e.g. MAO" className="uppercase" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-name`}>Office name</Label>
        <Input id={`${idPrefix}-name`} name="name" defaultValue={name} required maxLength={100} placeholder="e.g. Office of the Municipal Agriculturist" />
      </div>
    </>
  );
}

/** "Add office" button that opens a dialog. A new office starts without a head. */
export function AddOfficeButton() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    startTransition(async () => {
      const result = await createOfficeAction({ error: null }, formData);
      if (result.error) return setError(result.error); // the dialog stays open with what was typed
      toast.success(result.message);
      form.reset();
      setError("");
      setOpen(false);
    });
  };

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Plus size={16} /> Add office
      </Button>
      <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add office</DialogTitle>
            <DialogDescription>
              The new office has no head yet. Its employees cannot file leave until you set the head below.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <OfficeFields idPrefix="new-office" />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Adding…" : "Add office"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** "Rename" button for one office. Its head and employees stay with it. */
export function RenameOfficeButton({ officeId, name }: { officeId: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await updateOfficeAction(officeId, { error: null }, formData);
      if (result.error) return setError(result.error); // the dialog stays open with what was typed
      toast.success(result.message);
      setError("");
      setOpen(false);
    });
  };

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)} aria-label={`Rename ${name}`}>
        <Pencil size={14} /> Rename
      </Button>
      <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename office</DialogTitle>
            <DialogDescription>The head and the employees stay with the office. Past records show the new name.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <OfficeFields code={officeId} name={name} idPrefix={`office-${officeId}`} />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
