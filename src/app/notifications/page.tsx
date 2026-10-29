import Link from "next/link";
import { requirePageSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { NotificationsClient } from "./NotificationsClient";

export default async function NotificationsPage() {
  const session = await requirePageSession();
  const db = getDb();

  const { data: notifications } = await db
    .from("notifications")
    .select("*")
    .eq("recipient_login_id", session.login_id)
    .order("created_at", { ascending: false })
    .limit(50);

  const backUrl = session.eklink_role === "student" ? "/" : "/inbox";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-16">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link
            href={backUrl}
            className="text-sm font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1.5"
          >
            ← Back
          </Link>
          <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono">
            {session.name} ({session.login_id})
          </span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Notifications
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Real-time updates on your application submissions, reviewer actions, and remarks.
          </p>
        </div>

        <NotificationsClient
          initialNotifications={notifications || []}
          userRole={session.eklink_role}
        />
      </main>
    </div>
  );
}
