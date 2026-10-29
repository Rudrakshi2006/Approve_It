import { redirect } from "next/navigation";
import Link from "next/link";
import { requirePageSession } from "@/lib/auth";
import { listApplicationsByApplicant } from "@/lib/repos/applications";
import { formatToIST } from "@/lib/date";

export default async function HomePage() {
  const session = await requirePageSession();

  // If approver role, redirect to inbox
  if (session.eklink_role !== "student") {
    redirect("/inbox");
  }

  const applications = await listApplicationsByApplicant(session.login_id);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Top Navbar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-bold text-lg text-slate-900 tracking-tight">
              ApproveIt
            </span>
            <span className="text-xs bg-emerald-100 text-emerald-800 font-medium px-2 py-0.5 rounded-full">
              Student Portal
            </span>
          </div>

          <div className="flex items-center gap-4 text-sm">
            <div className="text-right">
              <p className="font-semibold text-slate-900">{session.name}</p>
              <p className="text-xs text-slate-500 font-mono">
                {session.login_id} • {session.department || "CSE"}
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

      {/* Main Content Area */}
      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Application Types Tabs */}
        <div className="flex border-b border-slate-200 mb-6 gap-2">
          <button className="px-4 py-2 border-b-2 border-slate-900 font-semibold text-slate-900 text-sm">
            Medical Leave
          </button>
          <button
            disabled
            className="px-4 py-2 text-slate-400 text-sm font-medium cursor-not-allowed flex items-center gap-1.5"
          >
            Hackathon
            <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.2 rounded">
              Coming soon
            </span>
          </button>
          <button
            disabled
            className="px-4 py-2 text-slate-400 text-sm font-medium cursor-not-allowed flex items-center gap-1.5"
          >
            Re-CA
            <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.2 rounded">
              Coming soon
            </span>
          </button>
          <button
            disabled
            className="px-4 py-2 text-slate-400 text-sm font-medium cursor-not-allowed flex items-center gap-1.5"
          >
            General
            <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.2 rounded">
              Coming soon
            </span>
          </button>
        </div>

        {/* Action Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Medical Applications</h1>
            <p className="text-sm text-slate-600">
              Apply for leave and track multi-step verification status in real-time.
            </p>
          </div>

          <Link
            href="/apply/medical"
            className="bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium px-4 py-2 rounded-md shadow-sm transition"
          >
            + Apply Medical Leave
          </Link>
        </div>

        {/* Applications List */}
        {applications.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-lg p-12 text-center">
            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-400">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="font-semibold text-slate-800 text-base mb-1">
              No Medical Applications Yet
            </h3>
            <p className="text-slate-500 text-sm mb-5 max-w-sm mx-auto">
              Submit an application with supporting medical certificates for verification by your Class Teacher and HOD.
            </p>
            <Link
              href="/apply/medical"
              className="inline-block bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium px-4 py-2 rounded-md transition"
            >
              Start Application
            </Link>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs uppercase font-medium">
                <tr>
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
                      <div className="flex items-center gap-2">
                        {app.urgent && (
                          <span className="bg-rose-100 text-rose-700 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase">
                            Urgent
                          </span>
                        )}
                        <span className="font-medium text-slate-900">{app.subject}</span>
                      </div>
                      <span className="text-xs text-slate-500">ID: {app.id.slice(0, 8)}...</span>
                    </td>
                    <td className="px-5 py-4 text-slate-600 text-xs">
                      {formatToIST(app.created_at)}
                    </td>
                    <td className="px-5 py-4">
                      {app.status === "in_review" && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                          In Review (Step {app.current_step + 1})
                        </span>
                      )}
                      {app.status === "approved" && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          Approved
                        </span>
                      )}
                      {app.status === "rejected" && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                          Rejected
                        </span>
                      )}
                      {app.status === "returned" && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                          Returned
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Link
                        href={`/applications/${app.id}`}
                        className="text-xs font-semibold text-slate-900 hover:text-slate-700 hover:underline"
                      >
                        View Status →
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
