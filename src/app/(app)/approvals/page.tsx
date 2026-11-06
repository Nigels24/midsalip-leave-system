// For My Action: applications waiting for the logged-in officer, oldest first (first come, first served),
// plus the ones they acted on before. Which applications wait for whom is decided by
// waitingForWhere() in src/server/leave/workflow.ts, the same rule the sidebar badge uses.
import { connection } from "next/server";
import type { Role } from "@/generated/prisma/client";
import { ApplicationsTable } from "@/components/leave/applications-table";
import { Card } from "@/components/ui/card";
import { rolesFor } from "@/config/nav";
import { ROLE_LABELS } from "@/lib/constants";
import { db } from "@/lib/db";
import { requireRole } from "@/server/auth";
import { waitingForWhere } from "@/server/leave";

const STEP_TEXT: Partial<Record<Role, string>> = {
  DEPT_HEAD: "Applications from your office waiting for your recommendation.",
  HRMO: "Applications waiting for certification of leave credits (and recommendation, for your own office).",
  APPROVER: "Applications recommended and certified, waiting for final approval (and recommendation, for your own office).",
};

// What the table needs: leave type name and the employee with office.
const rowInclude = {
  leaveType: { select: { name: true } },
  employee: { select: { firstName: true, middleInitial: true, lastName: true, office: { select: { id: true, name: true } } } },
} as const;

export default async function ApprovalsPage() {
  await connection();
  const user = await requireRole(...rolesFor("/approvals"));

  const [queue, acted] = await Promise.all([
    db.leaveApplication.findMany({ where: waitingForWhere(user), include: rowInclude, orderBy: { filedAt: "asc" } }),
    // History: applications of other people where this officer recorded a decision.
    db.leaveApplication.findMany({
      where: { employeeId: { not: user.id }, actions: { some: { actorId: user.id, step: { notIn: ["FILED", "CANCELLED"] } } } },
      include: rowInclude,
      orderBy: { updatedAt: "desc" },
      take: 15,
    }),
  ]);

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">For My Action</h1>
        <p className="mt-1 text-sm text-slate-500">
          {ROLE_LABELS[user.role]} · {STEP_TEXT[user.role]}
        </p>
      </div>

      <Card className="gap-0 py-0">
        <ApplicationsTable
          applications={queue}
          showEmployee
          actionLabel="Review"
          empty="You're all caught up — nothing is waiting for your action."
        />
      </Card>

      <h2 className="mb-3 mt-8 font-semibold text-slate-800">Previously acted on by me</h2>
      <Card className="gap-0 py-0">
        <ApplicationsTable applications={acted} showEmployee empty="No actions yet." />
      </Card>
    </>
  );
}
