// Notifications: the logged-in user's own notifications, newest first, 20 per page (?page=, ?unread=1).
// The buttons are small forms calling the server actions in src/server/notification-actions.ts,
// so they work without any client JavaScript. Marking read refreshes the sidebar badge.
import Link from "next/link";
import { connection } from "next/server";
import { Bell, CheckCheck } from "lucide-react";
import { buildHref, Pagination } from "@/components/list-controls";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { rolesFor } from "@/config/nav";
import { db } from "@/lib/db";
import { fmtDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { requireRole } from "@/server/auth";
import { markAllNotificationsReadAction, markNotificationReadAction, openNotificationAction } from "@/server/notification-actions";

const PAGE_SIZE = 20;

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<{ page?: string; unread?: string }> }) {
  await connection();
  const user = await requireRole(...rolesFor("/notifications"));
  const params = await searchParams;
  const unreadOnly = params.unread === "1";
  const page = Math.max(1, Number(params.page) || 1);

  const where = { userId: user.id, read: unreadOnly ? false : undefined }; // only the user's own rows
  const [total, unread, notifications] = await Promise.all([
    db.notification.count({ where }),
    db.notification.count({ where: { userId: user.id, read: false } }),
    db.notification.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageHref = (n: number) => buildHref("/notifications", { unread: unreadOnly ? "1" : undefined, page: n > 1 ? n : undefined });

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Notifications</h1>
          <p className="mt-1 text-sm text-slate-500">{unread === 0 ? "You are all caught up." : `${unread} unread`}</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={unreadOnly ? "/notifications" : "/notifications?unread=1"}>{unreadOnly ? "Show all" : "Unread only"}</Link>
          </Button>
          <form action={markAllNotificationsReadAction}>
            <Button type="submit" variant="secondary" size="sm" disabled={unread === 0}>
              <CheckCheck size={14} /> Mark all as read
            </Button>
          </form>
        </div>
      </div>

      <Card className="gap-0 py-0">
        {notifications.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <Bell className="mx-auto text-slate-300" size={36} />
            <p className="mt-3 text-sm text-slate-500">
              {unreadOnly ? "No unread notifications." : "No notifications yet. Updates on your applications will appear here."}
            </p>
          </div>
        ) : (
          <ul className="divide-y">
            {notifications.map((n) => (
              <li key={n.id} className={cn("flex gap-3 px-5 py-4", !n.read && "bg-brand-50/60")}>
                <span
                  className={cn(
                    "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                    n.read ? "bg-slate-100 text-slate-400" : "bg-brand-100 text-brand-700",
                  )}
                >
                  <Bell size={15} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-x-2">
                    <p className={cn("text-sm", n.read ? "text-slate-700" : "font-semibold text-slate-900")}>
                      {!n.read && <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-brand-600" aria-label="Unread" />}
                      {n.title}
                    </p>
                    <span className="text-xs text-slate-400">{fmtDateTime(n.createdAt)}</span>
                  </div>
                  <p className="mt-0.5 text-sm text-slate-600">{n.body}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {n.applicationId && (
                      <form action={openNotificationAction.bind(null, n.id)}>
                        <Button type="submit" size="xs">
                          Open application
                        </Button>
                      </form>
                    )}
                    {!n.read && (
                      <form action={markNotificationReadAction.bind(null, n.id)}>
                        <Button type="submit" size="xs" variant="outline">
                          Mark as read
                        </Button>
                      </form>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
        <Pagination page={page} pages={pages} shown={notifications.length} total={total} hrefFor={pageHref} />
      </Card>
    </>
  );
}
