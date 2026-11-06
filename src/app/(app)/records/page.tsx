// Leave Records (placeholder). Allowed roles come from the "/records" item in src/config/nav.ts.
import { ComingSoon } from "@/components/coming-soon";
import { rolesFor } from "@/config/nav";
import { requireRole } from "@/server/auth";

export default async function RecordsPage() {
  await requireRole(...rolesFor("/records"));
  return <ComingSoon title="Leave Records" description="All leave applications you are allowed to see." />;
}
