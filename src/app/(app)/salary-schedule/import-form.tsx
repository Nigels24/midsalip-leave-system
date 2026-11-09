"use client";
// Import a schedule in two steps: "Check" asks the server what would change (nothing is saved),
// then "Import" asks for confirmation and saves. The server parses and checks the text again
// on import, so the preview only informs the HRMO; it does not decide.
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { importScheduleAction, previewImportAction, type ImportPreview } from "@/server/salary-actions";

const EXAMPLE = "grade,step,amount\n1,1,14634\n1,2,14730\n…\n33,2,462329";

export function ImportForm() {
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [checking, startCheck] = useTransition();
  const [saving, startSave] = useTransition();

  const check = () =>
    startCheck(async () => {
      setPreview(await previewImportAction(text));
    });

  const save = () =>
    startSave(async () => {
      const result = await importScheduleAction(text);
      setConfirming(false);
      if (result.error) return void toast.error(result.error);
      toast.success(result.message);
      setText("");
      setPreview(null);
    });

  const counts = preview?.counts;
  const changes = counts ? counts.added + counts.changed : 0;

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="schedule-paste">Paste the schedule</Label>
        <Textarea
          id="schedule-paste"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setPreview(null); // the old preview no longer matches the text
          }}
          placeholder={EXAMPLE}
          rows={6}
          className="font-mono text-xs"
        />
        <p className="text-xs text-slate-500">
          A header line is optional. Each line adds or replaces the amount of its grade and step; grades and steps not in the
          paste keep their amount.
        </p>
      </div>

      {preview?.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <p>{preview.error}</p>
          {preview.errors.length > 0 && (
            <ul className="mt-1 list-disc pl-5">
              {preview.errors.slice(0, 10).map((e) => (
                <li key={e}>{e}</li>
              ))}
              {preview.errors.length > 10 && <li>…and {preview.errors.length - 10} more.</li>}
            </ul>
          )}
        </div>
      )}
      {counts && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {counts.total} line(s) read: <b>{counts.added}</b> new, <b>{counts.changed}</b> changed, {counts.unchanged} the same.
          {counts.kept > 0 && ` ${counts.kept} grade/step amount(s) not in the paste stay as they are.`}
        </p>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" onClick={check} disabled={checking || !text.trim()}>
          {checking ? "Checking…" : "Check"}
        </Button>
        <Button type="button" onClick={() => setConfirming(true)} disabled={!counts || changes === 0 || saving}>
          Import {changes > 0 ? `${changes} change(s)` : ""}
        </Button>
      </div>

      <Dialog open={confirming} onOpenChange={(open) => !saving && setConfirming(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import the pasted schedule?</DialogTitle>
            <DialogDescription>
              {counts?.added ?? 0} amount(s) will be added and {counts?.changed ?? 0} replaced. The amounts for this LGU are
              recomputed from the percentage. Salaries already saved on employee records are not changed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirming(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Importing…" : "Import"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
