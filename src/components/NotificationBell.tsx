import Link from "next/link";
import { getUnreadNotificationCount } from "@/lib/notifications";

export async function NotificationBell({ loginId }: { loginId: string }) {
  const unreadCount = await getUnreadNotificationCount(loginId);

  return (
    <Link
      href="/notifications"
      className="relative p-1.5 text-slate-600 hover:text-slate-900 transition flex items-center justify-center rounded-md hover:bg-slate-100"
      title="Notifications"
    >
      <svg
        className="w-5 h-5 stroke-current"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.75}
          d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
        />
      </svg>

      {unreadCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 bg-rose-600 text-white font-black text-[10px] w-4 h-4 rounded-full flex items-center justify-center ring-2 ring-white">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </Link>
  );
}
