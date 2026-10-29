"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatToIST } from "@/lib/date";

export interface NotificationItem {
  id: number;
  recipient_login_id: string;
  application_id: string | null;
  kind: string;
  message: string;
  read_at: string | null;
  created_at: string;
}

export function NotificationsClient({
  initialNotifications,
  userRole,
}: {
  initialNotifications: NotificationItem[];
  userRole: string;
}) {
  const router = useRouter();
  const [notifications, setNotifications] = useState(initialNotifications);
  const [markingAll, setMarkingAll] = useState(false);

  const handleClick = async (n: NotificationItem) => {
    // Mark as read in background if unread
    if (!n.read_at) {
      try {
        fetch(`/api/notifications/${n.id}/read`, { method: "POST" });
        setNotifications((prev) =>
          prev.map((item) =>
            item.id === n.id ? { ...item, read_at: new Date().toISOString() } : item
          )
        );
      } catch {
        // continue
      }
    }

    if (n.application_id) {
      const destination =
        userRole === "student"
          ? `/applications/${n.application_id}`
          : `/inbox/${n.application_id}`;
      router.push(destination);
    }
  };

  const handleMarkAllRead = async () => {
    setMarkingAll(true);
    try {
      const res = await fetch("/api/notifications/read-all", { method: "POST" });
      if (res.ok) {
        setNotifications((prev) =>
          prev.map((item) => ({ ...item, read_at: new Date().toISOString() }))
        );
        router.refresh();
      }
    } catch {
      // ignore
    } finally {
      setMarkingAll(false);
    }
  };

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  return (
    <div className="space-y-4">
      {/* Header action bar */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">
          Showing {notifications.length} recent notifications ({unreadCount} unread)
        </p>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            disabled={markingAll}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
          >
            {markingAll ? "Marking..." : "✓ Mark all as read"}
          </button>
        )}
      </div>

      {/* Notifications List */}
      {notifications.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-12 text-center">
          <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-400">
            🔔
          </div>
          <h3 className="font-semibold text-slate-800 text-sm mb-1">
            No Notifications Yet
          </h3>
          <p className="text-slate-500 text-xs">
            You will be alerted here whenever your applications are submitted, approved, or commented on.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {notifications.map((n) => {
            const isUnread = !n.read_at;
            const isUrgent = n.message.includes("URGENT");

            return (
              <div
                key={n.id}
                onClick={() => handleClick(n)}
                className={`p-4 rounded-lg border transition cursor-pointer select-none relative ${
                  isUnread
                    ? isUrgent
                      ? "bg-rose-50/70 border-rose-300 shadow-2xs hover:bg-rose-100/70"
                      : "bg-indigo-50/60 border-indigo-200 shadow-2xs hover:bg-indigo-100/60"
                    : "bg-white border-slate-200 hover:bg-slate-50"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      {isUnread && (
                        <span className="w-2 h-2 rounded-full bg-indigo-600 shrink-0"></span>
                      )}
                      <span className="text-xs font-bold text-slate-900 leading-snug">
                        {n.message}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      {formatToIST(n.created_at)}
                    </p>
                  </div>

                  {n.application_id && (
                    <span className="text-xs text-slate-400 hover:text-slate-700 shrink-0 font-medium">
                      View →
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
