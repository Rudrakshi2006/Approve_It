import Link from "next/link";
import { requirePageWorkflowAdmin } from "@/lib/auth";
import { AdminNav } from "../AdminNav";
import { PeopleClient } from "./PeopleClient";

export default async function AdminPeoplePage() {
  const session = await requirePageWorkflowAdmin();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-16">
      {/* Top Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-bold text-lg text-slate-900 tracking-tight">
              ApproveIt
            </span>
            <span className="text-xs bg-purple-100 text-purple-900 font-bold px-2.5 py-0.5 rounded-full uppercase">
              Workflow Administration
            </span>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <span className="text-slate-500 font-medium">
              Admin: <strong className="text-slate-900">{session.name}</strong> ({session.login_id})
            </span>
            <Link
              href="/inbox"
              className="px-3 py-1.5 border border-slate-300 rounded hover:bg-slate-100 font-semibold"
            >
              Approver Inbox
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            User Directory Management
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Bulk upload and sync SIT Nagpur faculty, staff, and student accounts via validated CSV files.
          </p>
        </div>

        <AdminNav current="people" />

        <PeopleClient />
      </main>
    </div>
  );
}
