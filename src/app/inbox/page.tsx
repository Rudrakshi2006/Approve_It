import { redirect } from "next/navigation";
import Link from "next/link";
import { requirePageSession } from "@/lib/auth";
import { listInboxForApprover } from "@/lib/repos/applications";
import { getDb } from "@/lib/db";
import { formatToIST, formatDatesInText } from "@/lib/date";
import { NotificationBell } from "@/components/NotificationBell";

export default async function InboxPage(props: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await requirePageSession();

  // If student accesses inbox, redirect to student dashboard
  if (session.eklink_role === "student") {
    redirect("/");
  }

  const isAdminStaff = session.eklink_role === "admin_staff" || session.login_id === "STA5001";

  const { tab = "pending" } = await props.searchParams;
  const activeTab = (
    isAdminStaff
      ? ["pending", "approved"].includes(tab)
        ? tab
        : "pending"
      : ["pending", "approved", "rejected", "returned"].includes(tab)
      ? tab
      : "pending"
  ) as "pending" | "approved" | "rejected" | "returned";

  const applications = await listInboxForApprover(session.login_id, activeTab);

  const db = getDb();
  const approverIds = Array.from(
    new Set(
      applications
        .map((a) => a.current_approver_login_id)
        .filter(Boolean) as string[]
    )
  );
  const approverNameMap: Record<string, string> = {};
  if (approverIds.length > 0) {
    const { data: people } = await db
      .from("people")
      .select("login_id, name")
      .in("login_id", approverIds);
    for (const p of people || []) {
      approverNameMap[p.login_id] = p.name;
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Navbar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-bold text-lg text-slate-900 tracking-tight">
              ApproveIt
            </span>
            <span className="text-xs bg-slate-900 text-white font-medium px-2 py-0.5 rounded-full capitalize">
              {session.eklink_role} Inbox
            </span>
          </div>

          <div className="flex items-center gap-4 text-sm">
            <NotificationBell loginId={session.login_id} />

            <div className="text-right">
              <p className="font-semibold text-slate-900">{session.name}</p>
              <p className="text-xs text-slate-500 font-mono">
                {session.login_id} • {session.department || "Faculty"}
              </p>
            </div>
            <Link
              href="/profile"
              className="text-xs px-2.5 py-1.5 border border-slate-300 rounded hover:bg-slate-100 text-slate-700 transition"
            >
              Profile
            </Link>
            <form action="/auth/logout" method="post">
              <button
                type="submit"
                className="text-xs px-3 py-1.5 border border-slate-300 rounded hover:bg-slate-100 text-slate-700 transition"
              >
                Logout
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            {isAdminStaff ? "Administration Staff Portal" : "Approver Inbox"}
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            {isAdminStaff
              ? "Verify student ERP attendance records and forward applications to the designated incharge."
              : "Review and digitally verify student leave applications assigned to your step."}
          </p>
        </div>

        {/* Inbox Tabs */}
        <div className="flex border-b border-slate-200 mb-6 gap-2">
          <Link
            href="/inbox?tab=pending"
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition ${
              activeTab === "pending"
                ? "border-slate-900 text-slate-900"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {isAdminStaff ? "Pending Verification" : "Pending Actions"}
          </Link>
          <Link
            href="/inbox?tab=approved"
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition ${
              activeTab === "approved"
                ? "border-slate-900 text-slate-900"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {isAdminStaff ? "Verified & Forwarded (Done)" : "Approved by You"}
          </Link>
          {!isAdminStaff && (
            <>
              <Link
                href="/inbox?tab=rejected"
                className={`px-4 py-2 text-sm font-semibold border-b-2 transition ${
                  activeTab === "rejected"
                    ? "border-slate-900 text-slate-900"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                Rejected
              </Link>
              <Link
                href="/inbox?tab=returned"
                className={`px-4 py-2 text-sm font-semibold border-b-2 transition ${
                  activeTab === "returned"
                    ? "border-slate-900 text-slate-900"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                On Hold / Returned
              </Link>
            </>
          )}
        </div>

        {/* Applications List */}
        {applications.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-lg p-12 text-center">
            <h3 className="font-semibold text-slate-800 text-base mb-1">
              {isAdminStaff
                ? activeTab === "pending"
                  ? "No Applications Pending Verification"
                  : "No Forwarded Applications Yet"
                : `No Applications in "${activeTab.replace("_", " ")}"`}
            </h3>
            <p className="text-slate-500 text-sm max-w-sm mx-auto">
              {isAdminStaff
                ? activeTab === "pending"
                  ? "All caught up! You have zero student applications awaiting ERP attendance verification."
                  : "No applications have been verified and forwarded by you yet."
                : activeTab === "pending"
                ? "You have zero applications currently awaiting your verification. All caught up!"
                : "No historical records found in this category."}
            </p>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs uppercase font-medium">
                <tr>
                  <th className="px-5 py-3">Applicant Student</th>
                  <th className="px-5 py-3">Subject</th>
                  <th className="px-5 py-3">Submitted</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {applications.map((app) => (
                  <tr key={app.id} className="hover:bg-slate-50/80 transition">
                    <td className="px-5 py-4">
                      <p className="font-semibold text-slate-900">
                        {app.applicant_snapshot.name}
                      </p>
                      <p className="text-xs text-slate-500 font-mono">
                        {app.applicant_snapshot.login_id} • {app.applicant_snapshot.department}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        {app.urgent && (
                          <span className="bg-rose-100 text-rose-700 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase flex items-center gap-1">
                            ⚡ Urgent
                          </span>
                        )}
                        <span className="font-medium text-slate-900">{formatDatesInText(app.subject)}</span>
                      </div>
                      <span className="text-xs text-slate-400 capitalize">
                        Type: {app.type.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-600 text-xs">
                      {formatToIST(app.created_at)}
                    </td>
                    <td className="px-5 py-4">
                      {app.status === "in_review" && (
                        <div>
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                            {app.current_approver_login_id === session.login_id
                              ? "Action Required (You)"
                              : `Pending with: ${approverNameMap[app.current_approver_login_id || ""] || "Approver"}`}
                          </span>
                          {app.chain_snapshot?.[app.current_step]?.label && (
                            <span className="block text-[11px] text-slate-500 mt-0.5 ml-1">
                              ({app.chain_snapshot[app.current_step].label})
                            </span>
                          )}
                        </div>
                      )}
                      {app.status === "approved" && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                          ✓ Approved
                        </span>
                      )}
                      {app.status === "rejected" && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800">
                          ✕ Rejected
                        </span>
                      )}
                      {app.status === "returned" && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800">
                          ↩ On Hold
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Link
                        href={`/inbox/${app.id}`}
                        className="text-xs font-bold text-slate-900 hover:text-slate-700 hover:underline"
                      >
                        Review &amp; Verify →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
