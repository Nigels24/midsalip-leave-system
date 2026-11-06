// Layout for every signed-in page: checks the session, counts the sidebar badges,
// then hands plain data (no password hash, no functions) to the AppShell client component.
import { connection } from "next/server";
import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/server/auth";
import { waitingForWhere } from "@/server/leave";
import { db } from "@/lib/db";
import { ROLE_LABELS } from "@/lib/constants";
import { fullName } from "@/lib/utils";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await connection(); // badge counts come from the database on every request
  const user = await requireUser();

  const [forMyAction, unreadNotifications] = await Promise.all([
    // Same filter as the For My Action page, so the badge and the list always agree.
    db.leaveApplication.count({ where: waitingForWhere(user) }),
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
