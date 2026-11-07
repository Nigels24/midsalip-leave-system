"use server";
// Notifications: mark read. Every query includes userId = the logged-in user, taken from the
// session, so nobody can touch another person's notifications even with a forged id.
// revalidatePath("/", "layout") also refreshes the unread badges in the sidebar and header.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "../lib/db";
import { requireUser } from "./auth";

const idSchema = z.string().min(1).max(64);

/** One notification (the "Mark as read" button on a row). Used as <form action={markNotificationReadAction.bind(null, id)}>. */
export async function markNotificationReadAction(id: string) {
  const user = await requireUser();
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return;
  await db.notification.updateMany({ where: { id: parsed.data, userId: user.id }, data: { read: true } });
  revalidatePath("/", "layout");
}

/** All of the user's notifications ("Mark all as read"). */
export async function markAllNotificationsReadAction() {
  const user = await requireUser();
  await db.notification.updateMany({ where: { userId: user.id, read: false }, data: { read: true } });
  revalidatePath("/", "layout");
}

/** Opening a notification's link: mark it read, then go to its application. */
export async function openNotificationAction(id: string) {
  const user = await requireUser();
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) redirect("/notifications");

  const notification = await db.notification.findFirst({ where: { id: parsed.data, userId: user.id }, select: { applicationId: true } });
  if (!notification) redirect("/notifications");
  await db.notification.updateMany({ where: { id: parsed.data, userId: user.id }, data: { read: true } });
  revalidatePath("/", "layout");
  // The application page checks access itself, as always.
  redirect(notification.applicationId ? `/applications/${notification.applicationId}` : "/notifications");
}
