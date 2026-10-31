import Link from "next/link";
import { NotificationBell } from "./NotificationBell";
import { formatToIST, formatDatesInText } from "@/lib/date";
import type { Session } from "@/lib/session";
import type { ApplicationRecord } from "@/lib/repos/types";

interface EmployeeDashboardProps {
  session: Session;
  balances: { medical: number; personal: number };
  person?: {
    saturday_group?: string;
    designation?: string;
    department?: string;
  } | null;
  applications: ApplicationRecord[];
  approverNameMap: Record<string, string>;
  pendingInboxCount: number;
  activeTab?: string;
}

export function EmployeeDashboard({
  session,
  balances,
  person,
  applications,
  approverNameMap,
  pendingInboxCount,
  activeTab = "all",
}: EmployeeDashboardProps) {
  const satGroup = person?.saturday_group === "even" ? "Even" : "Odd";
  const designation = person?.designation || (session.eklink_role === "hod" ? "Head of Department" : "Faculty / Staff");
  const dept = person?.department || session.department || "General";

  const filteredApps = applications.filter((app) => {
    if (activeTab === "leave") {
      return app.type === "employee_leave" || app.type === "hod_leave";
    }
    if (activeTab === "general") {
      return app.type === "employee_general" || app.type === "hod_general";
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Top Navbar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-black text-xl text-slate-900 tracking-tight">
              ApproveIt
            </span>
            <span className="text-xs bg-slate-900 text-white font-semibold px-2.5 py-0.5 rounded-full capitalize">
              Employee Portal
            </span>
          </div>

          <div className="flex items-center gap-3 text-sm">
            {/* Link to Approvals Inbox */}
            <Link
              href="/inbox"
              className="relative inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold px-3 py-1.5 rounded-md border border-slate-300 transition"
            >
              <span>📥 Approvals Inbox</span>
              {pendingInboxCount > 0 && (
                <span className="bg-amber-500 text-white text-[10px] font-black px-1.5 py-0.2 rounded-full">
                  {pendingInboxCount}
                </span>
              )}
            </Link>

            <NotificationBell loginId={session.login_id} />

            <div className="text-right hidden sm:block">
              <p className="font-semibold text-slate-900 text-xs">{session.name}</p>
              <p className="text-[11px] text-slate-500 font-mono">
                {session.login_id} • {dept}
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
                className="text-xs px-2.5 py-1.5 border border-slate-300 rounded hover:bg-slate-100 text-slate-700 transition"
              >
                Logout
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Welcome Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Welcome, {session.name}
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              {designation} • Department of {dept}
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Link
              href="/apply/employee/leave"
              className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold px-4 py-2.5 rounded-md shadow-sm transition flex items-center gap-1.5"
            >
              <span>🗓️</span>
              <span>+ Apply Leave</span>
            </Link>
            <Link
              href="/apply/employee/general"
              className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-4 py-2.5 rounded-md shadow-sm transition flex items-center gap-1.5"
            >
              <span>📄</span>
              <span>+ New General Request</span>
            </Link>
          </div>
        </div>

        {/* Leave Ledger Balance Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {/* Personal Leave */}
          <div className="bg-white border-2 border-slate-900 rounded-lg p-5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Personal Leave Balance
              </span>
              <span className="text-xs bg-slate-100 font-mono text-slate-700 px-2 py-0.5 rounded font-bold">
                Cap 12
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-slate-900 font-mono">
                {balances.personal}
              </span>
              <span className="text-xs text-slate-500 font-medium">days available</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-2">
              Accrues +1 day on 1st of every month. No reset at year end.
            </p>
          </div>

          {/* Medical Leave */}
          <div className="bg-white border-2 border-slate-900 rounded-lg p-5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Medical Leave Balance
              </span>
              <span className="text-xs bg-slate-100 font-mono text-slate-700 px-2 py-0.5 rounded font-bold">
                Cap 12
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-emerald-800 font-mono">
                {balances.medical}
              </span>
              <span className="text-xs text-slate-500 font-medium">days available</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-2">
              For illness &amp; medical recovery. Accrues +1 day per calendar month.
            </p>
          </div>

          {/* Saturday Roster Group */}
          <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Saturday Work Group
              </span>
              <span className="text-xs bg-indigo-100 text-indigo-900 font-bold px-2 py-0.5 rounded font-mono">
                {satGroup} Group
              </span>
            </div>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-base font-bold text-slate-900">
                {satGroup === "Odd" ? "1st & 3rd Saturdays" : "2nd & 4th Saturdays"}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-2">
              {satGroup === "Odd"
                ? "2nd, 4th, & 5th Saturdays are official off-days and excluded from leave count."
                : "1st, 3rd, & 5th Saturdays are official off-days and excluded from leave count."}
            </p>
          </div>
        </div>

        {/* My Applications Section */}
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                My Submitted Applications
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Track status, reviewer feedback, and digital stamps for your applications.
              </p>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-md text-xs font-semibold">
              <Link
                href="/?tab=all"
                className={`px-3 py-1 rounded transition ${
                  activeTab === "all" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                All ({applications.length})
              </Link>
              <Link
                href="/?tab=leave"
                className={`px-3 py-1 rounded transition ${
                  activeTab === "leave" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Leave ({applications.filter((a) => a.type.includes("leave")).length})
              </Link>
              <Link
                href="/?tab=general"
                className={`px-3 py-1 rounded transition ${
                  activeTab === "general" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                General ({applications.filter((a) => a.type.includes("general")).length})
              </Link>
            </div>
          </div>

          {filteredApps.length === 0 ? (
            <div className="p-12 text-center">
              <span className="text-3xl block mb-2">📁</span>
              <h3 className="font-bold text-slate-800 text-sm mb-1">
                No Applications Found
              </h3>
              <p className="text-slate-500 text-xs max-w-sm mx-auto mb-4">
                You haven&apos;t submitted any {activeTab !== "all" ? activeTab : ""} applications yet.
              </p>
              <div className="flex items-center justify-center gap-2">
                <Link
                  href="/apply/employee/leave"
                  className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold px-3 py-1.5 rounded transition"
                >
                  Apply Leave
                </Link>
                <Link
                  href="/apply/employee/general"
                  className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-3 py-1.5 rounded transition"
                >
                  General Request
                </Link>
              </div>
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs uppercase font-medium">
                <tr>
                  <th className="px-5 py-3">Subject / Request</th>
                  <th className="px-5 py-3">Type</th>
                  <th className="px-5 py-3">Submitted</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredApps.map((app) => {
                  const isLeave = app.type.includes("leave");
                  const workingDays = isLeave ? (app.payload as any)?.working_days : null;

                  return (
                    <tr key={app.id} className="hover:bg-slate-50/80 transition">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          {app.urgent && (
                            <span className="bg-rose-100 text-rose-700 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase">
                              ⚡ Urgent
                            </span>
                          )}
                          <span className="font-semibold text-slate-900">
                            {formatDatesInText(app.subject)}
                          </span>
                        </div>
                        {isLeave && workingDays && (
                          <span className="text-xs text-emerald-800 font-medium block mt-0.5">
                            Duration: {workingDays} working day(s)
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-xs bg-slate-100 text-slate-800 font-mono px-2 py-0.5 rounded uppercase font-bold">
                          {app.type.replace("employee_", "").replace("hod_", "").toUpperCase()}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-xs text-slate-600 font-mono">
                        {formatToIST(app.created_at)}
                      </td>
                      <td className="px-5 py-4">
                        {app.status === "in_review" && (
                          <div>
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                              Pending: {approverNameMap[app.current_approver_login_id || ""] || "Designated Approver"}
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
                            ↩ Action Required (Returned)
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <Link
                          href={`/applications/${app.id}`}
                          className="text-xs font-bold text-slate-900 hover:text-slate-700 hover:underline"
                        >
                          View Status →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}
