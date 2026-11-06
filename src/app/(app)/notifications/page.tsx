// Notifications (placeholder). Allowed roles come from the "/notifications" item in src/config/nav.ts.
import { ComingSoon } from "@/components/coming-soon";
import { rolesFor } from "@/config/nav";
import { requireRole } from "@/server/auth";

export default async function NotificationsPage() {
  await requireRole(...rolesFor("/notifications"));
  return <ComingSoon title="Notifications" description="Updates on your applications and items for your action." />;
}
