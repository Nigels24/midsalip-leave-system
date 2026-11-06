// Employees & Accounts (placeholder). Allowed roles come from the "/employees" item in src/config/nav.ts.
import { ComingSoon } from "@/components/coming-soon";
import { rolesFor } from "@/config/nav";
import { requireRole } from "@/server/auth";

export default async function EmployeesPage() {
  await requireRole(...rolesFor("/employees"));
  return <ComingSoon title="Employees & Accounts" description="Employee records, user accounts and roles." />;
}
