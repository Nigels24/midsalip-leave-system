// Audit Trail (placeholder). Allowed roles come from the "/audit" item in src/config/nav.ts.
import { ComingSoon } from "@/components/coming-soon";
import { rolesFor } from "@/config/nav";
import { requireRole } from "@/server/auth";

export default async function AuditPage() {
  await requireRole(...rolesFor("/audit"));
  return <ComingSoon title="Audit Trail" description="Every sign-in, filing and approval action, with who did it and when." />;
}
