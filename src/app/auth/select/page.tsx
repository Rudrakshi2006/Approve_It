import Link from "next/link";
import { getEnv } from "@/lib/env";

export default function AuthSelectPage() {
  const env = getEnv();

  const personas = [
    {
      role: "Student",
      badge: "bg-blue-100 text-blue-800 border-blue-200",
      id: "24070521003",
      name: "Akshat Abhijeet Digalwar",
      details: "PRN: 24070521003 • CSE • Batch 2024-28 (Div A)",
      description: "Apply for Medical Leave, Hackathon NOC, Re-eval/CA, track approvals & download signed PDFs.",
      color: "hover:border-blue-500",
      buttonColor: "bg-blue-600 hover:bg-blue-700 text-white",
    },
    {
      role: "Admin Staff",
      badge: "bg-emerald-100 text-emerald-800 border-emerald-200",
      id: "STA5001",
      name: "Ramesh Pawar",
      details: "Staff ID: STA5001 • Department: ADMIN",
      description: "Manage people roster, workflow assignments, holiday calendar, and leave balances.",
      color: "hover:border-emerald-500",
      buttonColor: "bg-emerald-600 hover:bg-emerald-700 text-white",
    },
    {
      role: "Class Incharge / Faculty",
      badge: "bg-amber-100 text-amber-800 border-amber-200",
      id: "T036",
      name: "Dr. Sachin Harne",
      details: "Faculty ID: T036 • Department: CSE",
      description: "Review first-tier student applications, endorse with digital signature stamp, return for edits.",
      color: "hover:border-amber-500",
      buttonColor: "bg-amber-600 hover:bg-amber-700 text-white",
    },
    {
      role: "Faculty Reviewer",
      badge: "bg-teal-100 text-teal-800 border-teal-200",
      id: "T017",
      name: "Dr. Mrudula Nimbarte",
      details: "Faculty ID: T017 • Department: CSE",
      description: "Review faculty & student applications, apply leave, examine audit logs.",
      color: "hover:border-teal-500",
      buttonColor: "bg-teal-600 hover:bg-teal-700 text-white",
    },
    {
      role: "Head of Department (HOD)",
      badge: "bg-indigo-100 text-indigo-800 border-indigo-200",
      id: "T004",
      name: "Dr. Sagarkumar Shridhar Badhiye",
      details: "Faculty ID: T004 • Role: HOD CSE",
      description: "Final approving authority for medical & departmental requests, sign off leave.",
      color: "hover:border-indigo-500",
      buttonColor: "bg-indigo-600 hover:bg-indigo-700 text-white",
    },
    {
      role: "Director / Workflow Admin",
      badge: "bg-purple-100 text-purple-800 border-purple-200",
      id: "T001",
      name: "Dr. Nitin Rakesh",
      details: "Faculty ID: T001 • Role: Director",
      description: "Executive approval authority for high-value hackathons, special leaves, & institute policies.",
      color: "hover:border-purple-500",
      buttonColor: "bg-purple-600 hover:bg-purple-700 text-white",
    },
    {
      role: "Exam Cell Coordinator",
      badge: "bg-rose-100 text-rose-800 border-rose-200",
      id: "T009",
      name: "Dr. Pradnya Sulas Borkar",
      details: "Faculty ID: T009 • Exam Cell",
      description: "Process CA improvement, internal exam grievances & grade re-evaluations.",
      color: "hover:border-rose-500",
      buttonColor: "bg-rose-600 hover:bg-rose-700 text-white",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 text-white text-xs font-semibold mb-3">
            <span>ApproveIt Portal</span>
            <span className="text-slate-400">•</span>
            <span className="text-emerald-400">Integrated & Ready</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            Select an Account Persona
          </h1>
          <p className="mt-3 max-w-2xl mx-auto text-sm text-slate-600">
            Choose any test persona below to instantly enter the application with full real-time database access, workflows, digital signatures, and approvals.
          </p>
        </div>

        {/* Persona Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {personas.map((p) => (
            <div
              key={p.id}
              className={`bg-white border border-slate-200 rounded-xl p-5 shadow-xs transition-all flex flex-col justify-between ${p.color}`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span
                    className={`text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${p.badge}`}
                  >
                    {p.role}
                  </span>
                  <span className="text-xs font-mono text-slate-400">{p.id}</span>
                </div>
                <h3 className="text-base font-bold text-slate-900">{p.name}</h3>
                <p className="text-xs text-slate-500 font-mono mt-0.5">{p.details}</p>
                <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                  {p.description}
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] text-slate-400">Database-backed</span>
                <a
                  href={`/api/dev/session?id=${encodeURIComponent(p.id)}`}
                  className={`px-3.5 py-1.5 rounded-md text-xs font-semibold shadow-xs transition ${p.buttonColor}`}
                >
                  Enter as {p.role.split(" ")[0]} →
                </a>
              </div>
            </div>
          ))}
        </div>

        {/* EkLink OAuth Section */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 text-center shadow-xs">
          <div className="max-w-xl mx-auto">
            <h3 className="text-sm font-semibold text-slate-900">
              EkLink Central Authentication
            </h3>
            <p className="text-xs text-slate-500 mt-1 mb-4">
              Connect via college single sign-on (SSO) using your registered EkLink credentials.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <a
                href="/auth/login?provider=eklink"
                className="w-full sm:w-auto px-4 py-2 bg-slate-900 text-white rounded-md text-xs font-semibold hover:bg-slate-800 transition"
              >
                Sign In with EkLink SSO ↗
              </a>
              <span className="text-xs text-slate-400">or</span>
              <a
                href={`${env.EKLINK_URL}/dashboard`}
                target="_blank"
                rel="noreferrer"
                className="w-full sm:w-auto px-4 py-2 border border-slate-300 text-slate-700 rounded-md text-xs font-medium hover:bg-slate-50 transition"
              >
                Open EkLink Dashboard ↗
              </a>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-slate-400 mt-8">
          ApproveIt • Paperless Approvals & Workflow Management System
        </p>
      </div>
    </div>
  );
}
