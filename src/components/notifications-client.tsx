"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell, CheckCheck } from "lucide-react";

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  message: string;
  actionUrl: string | null;
  readAt: string | Date | null;
  createdAt: string | Date;
};

export function NotificationsClient({
  initialItems,
  initialUnreadCount,
}: {
  initialItems: NotificationItem[];
  initialUnreadCount: number;
}) {
  const [items, setItems] = useState<NotificationItem[]>(initialItems);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [filter, setFilter] = useState<"ALL" | "UNREAD">("ALL");
  const [busy, setBusy] = useState(false);

  async function markOneRead(id: string) {
    const res = await fetch(`/api/v1/notifications/${id}/read`, { method: "PATCH" });
    if (res.ok) {
      const now = new Date().toISOString();
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, readAt: n.readAt ?? now } : n)));
      setUnreadCount((c) => Math.max(0, c - 1));
    }
  }

  async function markAllRead() {
    setBusy(true);
    try {
      const res = await fetch("/api/v1/notifications/read-all", { method: "PATCH" });
      if (res.ok) {
        const now = new Date().toISOString();
        setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? now })));
        setUnreadCount(0);
      }
    } finally {
      setBusy(false);
    }
  }

  const visible = filter === "UNREAD" ? items.filter((i) => !i.readAt) : items;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-bold text-brand-600">Notification Centre</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight">Your Notifications</h1>
          <p className="mt-1 text-sm text-muted">{unreadCount} unread notification(s)</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setFilter("ALL")}
            className={`rounded-xl px-3.5 py-2 text-xs font-black ${filter === "ALL" ? "bg-brand-600 text-white" : "surface"}`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setFilter("UNREAD")}
            className={`rounded-xl px-3.5 py-2 text-xs font-black ${filter === "UNREAD" ? "bg-brand-600 text-white" : "surface"}`}
          >
            Unread ({unreadCount})
          </button>
          {unreadCount > 0 && (
            <button
              type="button"
              disabled={busy}
              onClick={markAllRead}
              className="surface inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-black text-brand-600 disabled:opacity-50"
            >
              <CheckCheck size={14} /> Mark all read
            </button>
          )}
        </div>
      </div>

      {visible.length ? (
        <div className="space-y-3">
          {visible.map((item) => {
            const unread = !item.readAt;
            return (
              <article
                key={item.id}
                className={`surface rounded-2xl p-5 ${unread ? "border border-brand-200 dark:border-brand-500/30" : ""}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <span className="text-[11px] font-black uppercase tracking-wider text-brand-600">{item.type}</span>
                    <h2 className="mt-1 text-base font-black">{item.title}</h2>
                  </div>
                  <span className="text-xs text-muted">
                    {new Date(item.createdAt).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}
                  </span>
                </div>
                <p className="mt-2 text-sm text-muted">{item.message}</p>
                <div className="mt-3 flex items-center gap-3">
                  {item.actionUrl && (
                    <Link
                      href={item.actionUrl}
                      onClick={() => {
                        if (unread) markOneRead(item.id);
                      }}
                      className="text-xs font-black text-brand-600 hover:underline"
                    >
                      Open details
                    </Link>
                  )}
                  {unread && (
                    <button
                      type="button"
                      onClick={() => markOneRead(item.id)}
                      className="text-xs font-bold text-muted hover:text-slate-900 dark:hover:text-white"
                    >
                      Mark as read
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="surface rounded-3xl p-10 text-center">
          <Bell className="mx-auto text-slate-300" size={32} />
          <p className="mt-3 text-sm font-black">No notifications to show</p>
          <p className="mt-1 text-xs text-muted">Updates from your study plan, revisions, and tests will appear here.</p>
        </div>
      )}
    </div>
  );
}
