import { redirect } from "next/navigation";
import Link from "next/link";
import { requirePageSession } from "@/lib/auth";
import { listInboxForApprover } from "@/lib/repos/applications";
import { formatToIST } from "@/lib/date";

export default async function InboxPage(props: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await requirePageSession();

  // If student accesses inbox, redirect to student dashboard
  if (session.eklink_role === "student") {
    redirect("/");
  }

  const { tab = "pending" } = await props.searchParams;
  const activeTab = (["pending", "approved", "rejected", "returned"].includes(tab)
    ? tab
    : "pending") as "pending" | "approved" | "rejected" | "returned";

  const applications = await listInboxForApprover(session.login_id, activeTab);

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
            <div className="text-right">
              <p className="font-semibold text-slate-900">{session.name}</p>
              <p className="text-xs text-slate-500 font-mono">
                {session.login_id} • {session.department || "Faculty"}
              </p>
            </div>
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
            Approver Inbox
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Review and digitally verify student leave applications assigned to your step.
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
            Pending Actions
          </Link>
          <Link
            href="/inbox?tab=approved"
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition ${
              activeTab === "approved"
                ? "border-slate-900 text-slate-900"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            Approved by You
          </Link>
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
        </div>

        {/* Applications List */}
        {applications.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-lg p-12 text-center">
            <h3 className="font-semibold text-slate-800 text-base mb-1">
              No Applications in &ldquo;{activeTab.replace("_", " ")}&rdquo;
            </h3>
            <p className="text-slate-500 text-sm max-w-sm mx-auto">
              {activeTab === "pending"
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
                          <span className="bg-rose-100 text-rose-700 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase">
                            Urgent
                          </span>
                        )}
                        <span className="font-medium text-slate-900">{app.subject}</span>
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
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                          Awaiting Decision
                        </span>
                      )}
                      {app.status === "approved" && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                          Approved
                        </span>
                      )}
                      {app.status === "rejected" && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800">
                          Rejected
                        </span>
                      )}
                      {app.status === "returned" && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800">
                          Returned
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Link
                        href={`/inbox/${app.id}`}
                        className="inline-block bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold px-3 py-1.5 rounded transition"
                      >
                        Review →
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
