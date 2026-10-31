import Link from "next/link";
import { getUnreadNotificationCount } from "@/lib/notifications";

export async function NotificationBell({ loginId }: { loginId: string }) {
  const unreadCount = await getUnreadNotificationCount(loginId);

  return (
    <Link
      href="/notifications"
      className="relative inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 transition text-xs font-semibold shadow-2xs"
      title="View Notifications"
    >
      <span className="relative flex items-center justify-center">
        <svg
          className="w-4 h-4 text-slate-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 bg-rose-600 text-white font-black text-[9px] w-3.5 h-3.5 rounded-full flex items-center justify-center ring-1 ring-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </span>
      <span>Notifications</span>
      {unreadCount > 0 && (
        <span className="bg-rose-100 text-rose-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
          {unreadCount}
        </span>
      )}
    </Link>
  );
}
