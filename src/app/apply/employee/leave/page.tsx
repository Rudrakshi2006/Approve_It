import { redirect } from "next/navigation";
import Link from "next/link";
import { requirePageSession } from "@/lib/auth";
import { EmployeeLeaveForm } from "./EmployeeLeaveForm";

export default async function ApplyEmployeeLeavePage() {
  const session = await requirePageSession();

  if (session.eklink_role === "student") {
    redirect("/");
  }
  if (session.eklink_role === "director" || session.login_id === "T001") {
    redirect("/inbox");
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <Link
            href="/"
            className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition flex items-center gap-1 mb-2"
          >
            ← Back to Dashboard
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Apply for Leave (Faculty &amp; Staff)
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Submit your medical or personal leave request.
            {session.eklink_role === "hod"
              ? " (Direct to Director Approval)"
              : " (Verified by HOD → Director Final Approval & Balance Deduction)"}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
          <EmployeeLeaveForm />
        </div>
      </div>
    </div>
  );
}
