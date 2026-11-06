// File Leave (placeholder). Allowed roles come from the "/apply" item in src/config/nav.ts.
import { ComingSoon } from "@/components/coming-soon";
import { rolesFor } from "@/config/nav";
import { requireRole } from "@/server/auth";

export default async function ApplyPage() {
  await requireRole(...rolesFor("/apply"));
  return <ComingSoon title="File Leave" description="File an application for leave (CS Form No. 6)." />;
}
