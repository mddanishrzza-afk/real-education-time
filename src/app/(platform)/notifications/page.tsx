import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { NotificationsClient } from "@/components/notifications-client";
import { getCurrentUser } from "@/lib/auth";
import { listNotifications } from "@/lib/notifications/service";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const data = await listNotifications(user.id, { page: 1, limit: 30 });
  return <NotificationsClient initialItems={JSON.parse(JSON.stringify(data.items))} initialUnreadCount={data.unreadCount} />;
}
