// Verify QR Code (public, no login). Type the reference number printed under the QR code,
// or scan the code with a phone camera, which opens /verify/[refNo] directly.
// The proxy (src/proxy.ts) lets /verify and /verify/* through without a session.
import { redirect } from "next/navigation";
import { Camera } from "lucide-react";
import { Card } from "@/components/ui/card";
import { normalizeRefNo } from "@/lib/verify";
import { VerifyForm } from "./verify-form";
import { VerifyFrame } from "./verify-frame";

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  // The prototype's QR codes used /verify?ref=...; send those to the new address.
  const { ref } = await searchParams;
  if (ref && normalizeRefNo(ref)) redirect(`/verify/${encodeURIComponent(normalizeRefNo(ref))}`);

  return (
    <VerifyFrame>
      <Card className="gap-3 p-5">
        <VerifyForm />
        <p className="flex items-start gap-2 text-xs text-slate-500">
          <Camera size={14} className="mt-0.5 shrink-0" /> Or scan the QR code on the printed CS Form No. 6 with any phone camera. It
          opens the result page directly.
        </p>
      </Card>
    </VerifyFrame>
  );
}
