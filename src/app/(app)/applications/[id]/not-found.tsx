// Shown when /applications/<id> does not exist (notFound() in page.tsx).
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function ApplicationNotFound() {
  return (
    <Card className="mx-auto max-w-md text-center">
      <CardHeader>
        <CardTitle>Application not found</CardTitle>
        <CardDescription>The link may be wrong, or the application does not exist.</CardDescription>
      </CardHeader>
      <CardContent>
        <Link href="/dashboard" className="text-sm font-medium text-brand-600 hover:underline">
          Back to dashboard
        </Link>
      </CardContent>
    </Card>
  );
}
