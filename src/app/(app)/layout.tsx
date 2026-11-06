// Layout for every signed-in page: checks the session, counts the sidebar badges,
// then hands plain data (no password hash, no functions) to the AppShell client component.
import { connection } from "next/server";
import { AppShell } from "@/components/app-shell";
import type { CurrentUser } from "@/server/auth";
import { requireUser } from "@/server/auth";
import { db } from "@/lib/db";
import { ROLE_LABELS } from "@/lib/constants";
import { fullName } from "@/lib/utils";

/** How many applications are waiting for this user's action (same rule as the prototype's actorsFor). */
function countForMyAction(user: CurrentUser) {
  switch (user.role) {
    case "DEPT_HEAD": // recommends applications from the office(s) they head
      return db.leaveApplication.count({
        where: { status: "FOR_RECOMMENDATION", employee: { office: { headId: user.id } } },
      });
    case "HRMO": // certifies leave credits
      return db.leaveApplication.count({ where: { status: "FOR_CERTIFICATION" } });
    case "APPROVER": // final approval
      return db.leaveApplication.count({ where: { status: "FOR_APPROVAL" } });
    default: // employees have no approval step
      return Promise.resolve(0);
  }
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await connection(); // badge counts come from the database on every request
  const user = await requireUser();

  const [forMyAction, unreadNotifications] = await Promise.all([
    countForMyAction(user),
    db.notification.count({ where: { userId: user.id, read: false } }),
  ]);

  return (
    <AppShell
      user={{
        name: fullName(user),
        initials: `${user.firstName[0]}${user.lastName[0]}`,
        role: user.role,
        roleLabel: ROLE_LABELS[user.role],
        position: user.position,
        officeName: user.office.name,
      }}
      badges={{ approvals: forMyAction, notifications: unreadNotifications }}
    >
      {children}
    </AppShell>
  );
}
