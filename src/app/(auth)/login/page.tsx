// Login page (public). Server component: it only decides what to show;
// the form itself is the client component in login-form.tsx.
import Link from "next/link";
import { redirect } from "next/navigation";
import { QrCode } from "lucide-react";
import { Seal } from "@/components/seal";
import { APP } from "@/lib/constants";
import { getCurrentUser } from "@/server/auth";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  // Already signed in (checked against the database) -> go straight in.
  const user = await getCurrentUser();
  if (user) redirect(user.mustChangePassword ? "/change-password" : "/dashboard");

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Left: brand panel (large screens only) */}
      <div className="relative hidden overflow-hidden bg-brand-900 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-brand-600/30" />
        <div className="absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-accent-400/10" />
        <div className="relative flex items-center gap-3">
          <Seal className="h-24 w-24" />
          <div>
            <p className="text-xs uppercase tracking-widest text-brand-100/80">Republic of the Philippines</p>
            <p className="font-semibold">{APP.agency}</p>
            <p className="text-sm text-brand-100/80">{APP.province}</p>
          </div>
        </div>
        <div className="relative max-w-md">
          <h1 className="text-4xl font-bold leading-tight">File, track and verify leave — without the paper chase.</h1>
          <p className="mt-4 text-brand-100/85">
            Apply online, see your leave credits anytime, follow your application through each signatory, and confirm
            the authenticity of any approved CS Form No. 6 by scanning its QR code.
          </p>
        </div>
        <p className="relative text-xs text-brand-100/70">{APP.footer}</p>
      </div>

      {/* Right: sign-in form */}
      <div className="flex flex-col items-center justify-center bg-muted px-4 py-10 sm:px-8">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <Seal className="h-16 w-16" />
            <div>
              <p className="font-semibold text-slate-900">{APP.agency}</p>
              <p className="text-xs text-muted-foreground">{APP.subtitle}</p>
            </div>
          </div>

          <LoginForm office={APP.office} />

          <Link href="/verify" className="mt-6 flex items-center justify-center gap-2 text-sm font-medium text-brand-600 hover:underline">
            <QrCode size={16} /> Verify a leave document
          </Link>
        </div>
      </div>
    </div>
  );
}
