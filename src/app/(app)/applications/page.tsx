// My Applications (placeholder). Allowed roles come from the "/applications" item in src/config/nav.ts.
import { ComingSoon } from "@/components/coming-soon";
import { rolesFor } from "@/config/nav";
import { requireRole } from "@/server/auth";

export default async function ApplicationsPage() {
  await requireRole(...rolesFor("/applications"));
  return <ComingSoon title="My Applications" description="Your leave applications and where each one is in the approval process." />;
}
