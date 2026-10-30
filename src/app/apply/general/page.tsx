import { redirect } from "next/navigation";
import Link from "next/link";
import { requirePageSession } from "@/lib/auth";
import { getFacultyList } from "@/lib/repos/applications";
import { calculateSuggestedSemester } from "@/lib/semester";
import { GeneralForm } from "./GeneralForm";

export default async function ApplyGeneralPage() {
  const session = await requirePageSession();

  if (session.eklink_role !== "student") {
    redirect("/inbox");
  }

  const facultyList = await getFacultyList();
  const suggestedSemester = calculateSuggestedSemester(session.batch || "");

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-16">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link
            href="/"
            className="text-sm font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1.5"
          >
            ← Back to Dashboard
          </Link>
          <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono">
            {session.login_id}
          </span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Apply for General Student Request
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Submit formal requests for Bonafide, LOR, gate pass, or other official student matters. Approval Chain: Faculty Mentor → HOD.
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-6 sm:p-8 shadow-sm">
          <GeneralForm
            session={session}
            facultyList={facultyList}
            suggestedSemester={suggestedSemester}
          />
        </div>
      </main>
    </div>
  );
}
