"use client";
// Reference number box on the public verify pages. It only moves the browser to
// /verify/[refNo]; the page there does the lookup on the server.
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { normalizeRefNo } from "@/lib/verify";

export function VerifyForm({ initial = "" }: { initial?: string }) {
  const router = useRouter();
  const [ref, setRef] = useState(initial);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const refNo = normalizeRefNo(ref);
    if (refNo) router.push(`/verify/${encodeURIComponent(refNo)}`);
  };

  return (
    <form onSubmit={submit} className="space-y-2">
      <label htmlFor="refNo" className="block text-sm font-medium text-slate-700">
        Reference number (printed under the QR code)
      </label>
      <div className="flex gap-2">
        <Input
          id="refNo"
          value={ref}
          onChange={(e) => setRef(e.target.value.toUpperCase())}
          placeholder="MMH-2026-XXXX-XXXX"
          className="font-mono"
          autoCapitalize="characters"
          autoComplete="off"
          required
        />
        <Button type="submit">
          <Search size={16} /> Verify
        </Button>
      </div>
    </form>
  );
}
