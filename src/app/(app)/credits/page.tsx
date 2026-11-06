// Leave Credits (placeholder). Allowed roles come from the "/credits" item in src/config/nav.ts.
import { ComingSoon } from "@/components/coming-soon";
import { rolesFor } from "@/config/nav";
import { requireRole } from "@/server/auth";

export default async function CreditsPage() {
  await requireRole(...rolesFor("/credits"));
  return <ComingSoon title="Leave Credits" description="Your vacation and sick leave balances and leave card." />;
}
