"use client";
// Set the e-signature by uploading a PNG/JPG or drawing it with the mouse or a finger.
// Either way the browser turns it into a PNG data URL that fits in 400 x 150 pixels,
// checks it with the same rule the server uses, and sends it to setSignatureAction.
import { useRef, useState, useTransition } from "react";
import { Eraser, PenLine, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { checkSignatureDataUrl, SIGNATURE_MAX_HEIGHT, SIGNATURE_MAX_WIDTH } from "@/lib/signature";
import { cn } from "@/lib/utils";
import { setSignatureAction } from "@/server/profile-actions";

type Mode = "upload" | "draw";

/** Shrinks an image to fit inside 400 x 150 (keeping its shape) and returns it as a PNG data URL. */
function toSignaturePng(image: CanvasImageSource, width: number, height: number) {
  const scale = Math.min(1, SIGNATURE_MAX_WIDTH / width, SIGNATURE_MAX_HEIGHT / height);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  canvas.getContext("2d")!.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
}

export function SignatureEditor({ current, updatedText }: { current: string | null; updatedText: string | null }) {
  const [mode, setMode] = useState<Mode>("draw");
  const [draft, setDraft] = useState<string | null>(null); // new signature not saved yet
  const [error, setError] = useState("");
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [padKey, setPadKey] = useState(0); // changing it gives a fresh, empty drawing pad
  const [pending, startTransition] = useTransition();

  /** Switching between Draw and Upload throws away the unsaved signature of the other tab. */
  const switchMode = (next: Mode) => {
    setMode(next);
    setDraft(null);
    setError("");
    setPadKey((k) => k + 1);
  };

  const save = (value: string | null) => {
    if (value) {
      const problem = checkSignatureDataUrl(value);
      if (problem) return setError(problem);
    }
    setError("");
    startTransition(async () => {
      const result = await setSignatureAction(value);
      if (result.error) return setError(result.error);
      setDraft(null);
      setPadKey((k) => k + 1);
      setConfirmRemove(false);
      toast.success(value ? "Signature saved." : "Signature removed.");
    });
  };

  const onFile = async (file: File | undefined) => {
    setError("");
    if (!file) return;
    if (file.type !== "image/png" && file.type !== "image/jpeg") return setError("Please choose a PNG or JPG image.");
    if (file.size > 5 * 1024 * 1024) return setError("That file is too big (5 MB at most before resizing).");
    try {
      const bitmap = await createImageBitmap(file);
      setDraft(toSignaturePng(bitmap, bitmap.width, bitmap.height));
      bitmap.close();
    } catch {
      setError("That image could not be read.");
    }
  };

  return (
    <div className="space-y-5">
      {/* Current signature */}
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Current signature</p>
        <div className="flex min-h-28 items-center justify-center rounded-lg border bg-white p-3">
          {current ? (
            // A data URL, so next/image optimization does not apply.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={current} alt="Your current e-signature" className="max-h-28 max-w-full object-contain" />
          ) : (
            <p className="text-sm text-slate-500">No signature yet</p>
          )}
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <span>{updatedText ? `Last updated ${updatedText}` : ""}</span>
          {current && (
            <Button variant="outline" size="sm" onClick={() => setConfirmRemove(true)} disabled={pending}>
              <Trash2 size={14} /> Remove signature
            </Button>
          )}
        </div>
      </div>

      {/* New signature */}
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Set a new signature</p>
        <div className="mb-3 flex gap-2">
          <Button variant={mode === "draw" ? "default" : "outline"} size="sm" onClick={() => switchMode("draw")}>
            <PenLine size={14} /> Draw
          </Button>
          <Button variant={mode === "upload" ? "default" : "outline"} size="sm" onClick={() => switchMode("upload")}>
            <Upload size={14} /> Upload PNG / JPG
          </Button>
        </div>

        {mode === "draw" ? (
          <DrawPad key={padKey} onChange={setDraft} />
        ) : (
          <div className="space-y-3">
            <input
              type="file"
              accept="image/png,image/jpeg"
              onChange={(e) => onFile(e.target.files?.[0])}
              className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-brand-700"
            />
            <p className="text-xs text-slate-500">Tip: sign on white paper with a dark pen and take a clear, close photo.</p>
            {draft && (
              <div className="flex min-h-28 items-center justify-center rounded-lg border border-dashed bg-white p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={draft} alt="New signature preview" className="max-h-28 max-w-full object-contain" />
              </div>
            )}
          </div>
        )}

        {error && <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <div className="mt-3 flex justify-end">
          <Button onClick={() => draft && save(draft)} disabled={!draft || pending}>
            {pending ? "Saving…" : "Save signature"}
          </Button>
        </div>
      </div>

      <Dialog open={confirmRemove} onOpenChange={(open) => !pending && setConfirmRemove(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove your e-signature?</DialogTitle>
            <DialogDescription>Forms you already signed keep their signature. New steps you sign will have none until you set one again.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmRemove(false)} disabled={pending}>
              Keep it
            </Button>
            <Button variant="destructive" onClick={() => save(null)} disabled={pending}>
              {pending ? "Removing…" : "Remove signature"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * A 400 x 150 canvas to sign on. Pointer events cover mouse, pen and touch.
 * The background stays transparent, so the signature sits cleanly on the printed form.
 * onChange gets the PNG data URL after each stroke, or null after Clear.
 */
function DrawPad({ onChange }: { onChange: (dataUrl: string | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasInk, setHasInk] = useState(false);

  /** Pointer position in canvas pixels (the canvas may be shown smaller than 400 px wide). */
  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) * canvas.width) / rect.width, y: ((e.clientY - rect.top) * canvas.height) / rect.height };
  };

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const ctx = e.currentTarget.getContext("2d")!;
    const { x, y } = point(e);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0f172a";
    ctx.beginPath();
    ctx.moveTo(x, y);
    drawing.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = e.currentTarget.getContext("2d")!;
    const { x, y } = point(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const end = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    drawing.current = false;
    setHasInk(true);
    onChange(e.currentTarget.toDataURL("image/png")); // already exactly 400 x 150
  };

  const clear = () => {
    const canvas = canvasRef.current!;
    canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height);
    setHasInk(false);
    onChange(null);
  };

  return (
    <div className="space-y-2">
      <canvas
        ref={canvasRef}
        width={SIGNATURE_MAX_WIDTH}
        height={SIGNATURE_MAX_HEIGHT}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        // touch-none: a finger on the pad draws instead of scrolling the page
        className={cn("w-full max-w-[400px] touch-none rounded-lg border border-dashed bg-white", hasInk ? "border-slate-400" : "border-slate-300")}
        aria-label="Signature pad: sign here with your mouse or finger"
      />
      <div className="flex max-w-[400px] items-center justify-between text-xs text-slate-500">
        <span>Sign inside the box.</span>
        <Button variant="outline" size="sm" onClick={clear} disabled={!hasInk}>
          <Eraser size={14} /> Clear
        </Button>
      </div>
    </div>
  );
}
