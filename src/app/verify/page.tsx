// Verify QR Code (public placeholder). No login needed: anyone who scans the QR code
// on a printed CS Form No. 6 lands here. The proxy lets /verify and /verify/* through.
import Link from "next/link";
import { Seal } from "@/components/seal";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { APP } from "@/lib/constants";

export default function VerifyPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="items-center text-center">
          <Seal className="mx-auto h-16 w-16" />
          <CardTitle className="text-xl">Verify a Leave Document</CardTitle>
          <CardDescription>{APP.issuer}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-center text-sm text-muted-foreground">
          <p>Scanning and checking reference numbers comes in a later step.</p>
          <Link href="/login" className="font-medium text-brand-600 hover:underline">
            Go to sign in
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
