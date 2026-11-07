"use client";
// Edit or delete one holiday, each in a small dialog. The server (holiday-rules.ts) decides.
// Same pattern as the other dialogs (cancel-button.tsx, post-button.tsx): the handler calls the
// action in a transition and closes the dialog itself on success. The edit form uses onSubmit
// (not action=), so React does not clear the fields: on a refusal the typed values stay.
import { useState, useTransition, type FormEvent } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fmtDate } from "@/lib/format";
import { deleteHolidayAction, updateHolidayAction } from "@/server/holiday-actions";

const NOTE = "Leave already filed is not recounted; only leave filed from now on uses the change.";

export function HolidayRowActions({ date, name }: { date: string; name: string }) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [saving, startSave] = useTransition();
  const [removing, startRemove] = useTransition();

  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startSave(async () => {
      const result = await updateHolidayAction(date, { error: null }, formData);
      if (result.error) return setError(result.error); // the dialog stays open with what was typed
      toast.success(result.message);
      setError("");
      setEditing(false);
    });
  };

  const remove = () =>
    startRemove(async () => {
      const result = await deleteHolidayAction(date);
      setDeleting(false);
      if (result.error) toast.error(result.error);
      else toast.success(result.message);
    });

  return (
    <div className="flex justify-end gap-1">
      <Button variant="ghost" size="sm" onClick={() => setEditing(true)} aria-label={`Edit ${name}`}>
        <Pencil size={14} /> Edit
      </Button>
      <Button variant="ghost" size="sm" className="text-red-600" onClick={() => setDeleting(true)} aria-label={`Delete ${name}`}>
        <Trash2 size={14} /> Delete
      </Button>

      <Dialog open={editing} onOpenChange={(open) => !saving && setEditing(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit holiday</DialogTitle>
            <DialogDescription>{NOTE}</DialogDescription>
          </DialogHeader>
          <form onSubmit={save} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor={`date-${date}`}>Date</Label>
              <Input id={`date-${date}`} name="date" type="date" defaultValue={date} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`name-${date}`}>Name</Label>
              <Input id={`name-${date}`} name="name" defaultValue={name} maxLength={100} required />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditing(false)} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleting} onOpenChange={(open) => !removing && setDeleting(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this holiday?</DialogTitle>
            <DialogDescription>
              {name} on {fmtDate(date)} will no longer be skipped when days are counted. {NOTE}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(false)} disabled={removing}>
              Keep it
            </Button>
            <Button variant="destructive" onClick={remove} disabled={removing}>
              {removing ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
