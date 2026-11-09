"use client";
// The schedule as a grid like DBM's Annex A: one row per salary grade, one column per step.
// Clicking a cell opens one dialog to edit that national amount. The server (salary-rules.ts) decides.
// Plain values only come in: national amounts as strings, effective amounts as whole-peso numbers.
import { useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtNum, peso } from "@/lib/format";
import { MAX_GRADE } from "@/lib/salary-grade";
import { updateScheduleAmountAction } from "@/server/salary-actions";

export interface ScheduleCell {
  grade: number;
  step: number;
  national: string; // "42178.00"
  effective: number; // 42178 (whole pesos)
}

const STEPS = [1, 2, 3, 4, 5, 6, 7, 8];

export function ScheduleTable({ rows, percent }: { rows: ScheduleCell[]; percent: string }) {
  const [editing, setEditing] = useState<ScheduleCell | null>(null);
  const [error, setError] = useState("");
  const [saving, startSave] = useTransition();

  const byKey = new Map(rows.map((r) => [`${r.grade}-${r.step}`, r]));
  const grades = Array.from({ length: MAX_GRADE }, (_, i) => i + 1);

  const open = (cell: ScheduleCell) => {
    setError("");
    setEditing(cell);
  };

  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing) return;
    const formData = new FormData(event.currentTarget);
    startSave(async () => {
      const result = await updateScheduleAmountAction(editing.grade, editing.step, formData);
      if (result.error) return setError(result.error); // the dialog stays open with what was typed
      toast.success(result.message);
      setEditing(null);
    });
  };

  return (
    <>
      <Table>
        <TableHeader className="bg-slate-50">
          <TableRow>
            <TableHead className="px-3">SG</TableHead>
            {STEPS.map((s) => (
              <TableHead key={s} className="px-3 text-right">
                Step {s}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {grades.map((grade) => (
            <TableRow key={grade}>
              <TableCell className="px-3 font-semibold">{grade}</TableCell>
              {STEPS.map((step) => {
                const cell = byKey.get(`${grade}-${step}`);
                return (
                  <TableCell key={step} className="p-1 text-right">
                    {cell ? (
                      <button
                        type="button"
                        onClick={() => open(cell)}
                        className="w-full rounded px-2 py-1 text-right hover:bg-brand-50 focus-visible:outline-2"
                        aria-label={`Edit SG ${grade} Step ${step}`}
                      >
                        <span className="block font-medium tabular-nums text-slate-900">{peso(cell.effective)}</span>
                        <span className="block text-xs tabular-nums text-slate-500">{fmtNum(cell.national)}</span>
                      </button>
                    ) : (
                      <span className="px-2 text-slate-300">—</span>
                    )}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={editing !== null} onOpenChange={(isOpen) => !saving && !isOpen && setEditing(null)}>
        <DialogContent>
          {editing && (
            <>
              <DialogHeader>
                <DialogTitle>
                  SG {editing.grade}, Step {editing.step}
                </DialogTitle>
                <DialogDescription>
                  Enter the national amount from the DBM salary schedule. This LGU pays {percent}% of it, rounded to the
                  nearest peso (now {peso(editing.effective)}). Salaries already saved on employee records are not changed.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={save} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="national-amount">National monthly amount (₱)</Label>
                  <Input id="national-amount" name="amount" inputMode="decimal" defaultValue={editing.national.replace(/\.00$/, "")} required />
                </div>
                {error && <p className="text-sm text-red-600">{error}</p>}
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setEditing(null)} disabled={saving}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? "Saving…" : "Save"}
                  </Button>
                </DialogFooter>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
