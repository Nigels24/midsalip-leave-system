// Leave Calendar (placeholder). Allowed roles come from the "/calendar" item in src/config/nav.ts.
import { ComingSoon } from "@/components/coming-soon";
import { rolesFor } from "@/config/nav";
import { requireRole } from "@/server/auth";

export default async function CalendarPage() {
  await requireRole(...rolesFor("/calendar"));
  return <ComingSoon title="Leave Calendar" description="Approved and pending leave by date." />;
}
