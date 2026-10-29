import { redirect } from "next/navigation";
import Link from "next/link";
import { requirePageSession } from "@/lib/auth";
import { listApplicationsByApplicant } from "@/lib/repos/applications";
import { formatToIST } from "@/lib/date";

export default async function HomePage(props: {
  searchParams: Promise<{ type?: string }>;
}) {
  const session = await requirePageSession();

  // If approver role, redirect to inbox
  if (session.eklink_role !== "student") {
    redirect("/inbox");
  }

  const { type = "medical" } = await props.searchParams;
  const activeType = ["medical", "hackathon", "re_ca", "general"].includes(type)
    ? type
    : "medical";

  const allApplications = await listApplicationsByApplicant(session.login_id);
  const applications = allApplications.filter((a) => a.type === activeType);

  const typeConfig: Record<
    string,
    { title: string; desc: string; applyUrl: string; btnLabel: string; emptyTitle: string; emptyDesc: string }
  > = {
    medical: {
      title: "Medical Leave Applications",
      desc: "Apply for illness leave with medical proof. Chain: Class Teacher → HOD.",
      applyUrl: "/apply/medical",
      btnLabel: "+ Apply Medical Leave",
      emptyTitle: "No Medical Applications Yet",
      emptyDesc: "Submit an application with supporting medical certificates for verification by your Class Teacher and HOD.",
    },
    hackathon: {
      title: "Hackathon & Competition Leave",
      desc: "Apply for on-duty leave to represent college. Chain: Admin Staff (Attendance) → Hackathon Incharge (Dr. Sachin Harne) → HOD → Director.",
      applyUrl: "/apply/hackathon",
      btnLabel: "+ Apply Hackathon Leave",
      emptyTitle: "No Hackathon Applications Yet",
      emptyDesc: "Submit your hackathon shortlist or event invitation letter for multi-step approval.",
    },
    re_ca: {
      title: "Re-Continuous Assessment (Re-CA)",
      desc: "Apply to re-appear for a missed internal test. Chain: Course Faculty → HOD → Exam Cell.",
      applyUrl: "/apply/re_ca",
      btnLabel: "+ Apply for Re-CA",
      emptyTitle: "No Re-CA Applications Yet",
      emptyDesc: "Submit a request with valid proof for a missed continuous assessment test.",
    },
    general: {
      title: "General Applications",
      desc: "Formal requests for Bonafide, LOR, gate pass, or other permissions. Chain: Mentor/Faculty → HOD.",
      applyUrl: "/apply/general",
      btnLabel: "+ Submit General Request",
      emptyTitle: "No General Applications Yet",
      emptyDesc: "Submit an official request to your faculty mentor and HOD.",
    },
  };

  const current = typeConfig[activeType];

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
          <Link
            href="/?type=medical"
            className={`px-4 py-2 border-b-2 font-semibold text-sm transition ${
              activeType === "medical"
                ? "border-slate-900 text-slate-900"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            Medical Leave
          </Link>
          <Link
            href="/?type=hackathon"
            className={`px-4 py-2 border-b-2 font-semibold text-sm transition ${
              activeType === "hackathon"
                ? "border-slate-900 text-slate-900"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            Hackathon &amp; Competitions
          </Link>
          <Link
            href="/?type=re_ca"
            className={`px-4 py-2 border-b-2 font-semibold text-sm transition ${
              activeType === "re_ca"
                ? "border-slate-900 text-slate-900"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            Re-CA (Exam)
          </Link>
          <Link
            href="/?type=general"
            className={`px-4 py-2 border-b-2 font-semibold text-sm transition ${
              activeType === "general"
                ? "border-slate-900 text-slate-900"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            General Request
          </Link>
        </div>

        {/* Action Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl font-bold text-slate-900">{current.title}</h1>
            <p className="text-sm text-slate-600 mt-0.5">{current.desc}</p>
          </div>

          <Link
            href={current.applyUrl}
            className="inline-flex items-center justify-center bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold px-4 py-2.5 rounded-md shadow-sm transition shrink-0"
          >
            {current.btnLabel}
          </Link>
        </div>

        {/* Applications List */}
        {applications.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-lg p-12 text-center">
            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-400">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <h3 className="font-semibold text-slate-800 text-base mb-1">
              {current.emptyTitle}
            </h3>
            <p className="text-slate-500 text-sm mb-5 max-w-sm mx-auto">
              {current.emptyDesc}
            </p>
            <Link
              href={current.applyUrl}
              className="inline-block bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold px-4 py-2 rounded-md transition"
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
                            ⚡ Urgent
                          </span>
                        )}
                        <span className="font-medium text-slate-900">{app.subject}</span>
                      </div>
                      <span className="text-xs text-slate-400 font-mono">
                        ID: {app.id.slice(0, 8)}...
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-600 text-xs">
                      {formatToIST(app.created_at)}
                    </td>
                    <td className="px-5 py-4">
                      {app.status === "in_review" && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                          In Review (Step {app.current_step + 1} of {app.chain_snapshot.length})
                        </span>
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
                          ↩ Returned
                        </span>
                      )}
                      {app.status === "cancelled" && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                          Withdrawn
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Link
                        href={`/applications/${app.id}`}
                        className="text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:underline"
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
