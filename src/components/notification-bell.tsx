"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, CheckCheck } from "lucide-react";

type BellNotification = {
  id: string;
  title: string;
  message: string;
  actionUrl: string | null;
  readAt: string | null;
  createdAt: string;
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<BellNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  async function fetchRecent() {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/notifications?limit=6");
      if (res.ok) {
        const data = await res.json();
        setItems(data.items ?? []);
        setUnreadCount(data.unreadCount ?? 0);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchRecent();
  }, []);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  async function markRead(id: string) {
    const res = await fetch(`/api/v1/notifications/${id}/read`, { method: "PATCH" });
    if (res.ok) {
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)));
      setUnreadCount((c) => Math.max(0, c - 1));
    }
  }

  async function markAllRead() {
    const res = await fetch("/api/v1/notifications/read-all", { method: "PATCH" });
    if (res.ok) {
      const now = new Date().toISOString();
      setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? now })));
      setUnreadCount(0);
    }
  }

  const badgeText = unreadCount > 99 ? "99+" : String(unreadCount);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next) fetchRecent();
        }}
        aria-label={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : "Notifications"}
        aria-expanded={open}
        className="focus-ring surface relative grid size-10 place-items-center rounded-xl text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 min-w-[18px] rounded-full bg-rose-600 px-1 text-center text-[10px] font-black leading-[18px] text-white">
            {badgeText}
          </span>
        )}
      </button>

      {open && (
        <div className="surface absolute right-0 mt-2 w-80 max-w-[90vw] rounded-2xl border border-ui p-3 shadow-xl sm:w-96">
          <div className="flex items-center justify-between border-b border-ui pb-2.5">
            <span className="text-sm font-black">Notifications</span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="inline-flex items-center gap-1 text-xs font-bold text-brand-600 hover:underline"
              >
                <CheckCheck size={14} /> Mark all read
              </button>
            )}
          </div>

          <div className="mt-2 max-h-80 space-y-1.5 overflow-y-auto">
            {loading && items.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted">Loading...</p>
            ) : items.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted">You&apos;re all caught up.</p>
            ) : (
              items.map((item) => {
                const unread = !item.readAt;
                const content = (
                  <div
                    className={`rounded-xl p-2.5 transition ${
                      unread ? "bg-brand-50/70 dark:bg-brand-500/10" : "hover:bg-[var(--surface-soft)]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-black">{item.title}</p>
                      {unread && <span className="mt-1 size-2 shrink-0 rounded-full bg-brand-600" />}
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-muted">{item.message}</p>
                    <p className="mt-1 text-[10px] font-semibold text-muted">
                      {new Date(item.createdAt).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}
                    </p>
                  </div>
                );

                return item.actionUrl ? (
                  <Link
                    key={item.id}
                    href={item.actionUrl}
                    onClick={() => {
                      if (unread) markRead(item.id);
                      setOpen(false);
                    }}
                    className="block"
                  >
                    {content}
                  </Link>
                ) : (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      if (unread) markRead(item.id);
                    }}
                    className="block w-full text-left"
                  >
                    {content}
                  </button>
                );
              })
            )}
          </div>

          <div className="mt-2 border-t border-ui pt-2 text-center">
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="text-xs font-black text-brand-600 hover:underline"
            >
              View all notifications
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
