// For My Action (placeholder). Allowed roles come from the "/approvals" item in src/config/nav.ts.
import { ComingSoon } from "@/components/coming-soon";
import { rolesFor } from "@/config/nav";
import { requireRole } from "@/server/auth";

export default async function ApprovalsPage() {
  await requireRole(...rolesFor("/approvals"));
  return <ComingSoon title="For My Action" description="Applications waiting for your recommendation, certification or approval." />;
}
