// The frame of the public verify pages: the app's colors and seal, but no sidebar or login.
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Seal } from "@/components/seal";
import { APP } from "@/lib/constants";

export function VerifyFrame({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-gradient-to-b from-brand-900 to-brand-700 px-4 py-8">
      <div className="mx-auto max-w-lg space-y-5">
        <div className="flex items-center gap-3 text-white">
          <Seal className="h-12 w-12 shrink-0" />
          <div>
            <p className="text-xs uppercase tracking-widest text-brand-100/80">{APP.agency}</p>
            <h1 className="text-xl font-bold">Leave Document Verification</h1>
          </div>
        </div>
        {children}
        <div className="text-center">
          {/* "/" sends a signed-in user to the dashboard and anyone else to the login page. */}
          <Link href="/" className="inline-flex items-center gap-1 text-sm text-brand-100 hover:text-white">
            <ArrowLeft size={14} /> {APP.name}
          </Link>
        </div>
      </div>
    </main>
  );
}
