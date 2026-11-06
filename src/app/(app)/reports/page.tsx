// Reports (placeholder). Allowed roles come from the "/reports" item in src/config/nav.ts.
import { ComingSoon } from "@/components/coming-soon";
import { rolesFor } from "@/config/nav";
import { requireRole } from "@/server/auth";

export default async function ReportsPage() {
  await requireRole(...rolesFor("/reports"));
  return <ComingSoon title="Reports" description="Leave summaries and printable reports." />;
}
