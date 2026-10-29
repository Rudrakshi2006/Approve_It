import { notFound } from "next/navigation";
import Link from "next/link";
import { requirePageSession } from "@/lib/auth";
import { getApplicationById } from "@/lib/repos/applications";
import { formatToIST } from "@/lib/date";
import { VerifiedStamp } from "@/components/VerifiedStamp";
import { AttachmentItem } from "./AttachmentItem";

export default async function ApplicationStatusPage(props: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePageSession();
  const { id } = await props.params;

  const app = await getApplicationById(id);

  // If application doesn't exist, return 404
  if (!app) {
    notFound();
  }

  // Authorization check: only the applicant can view this student tracking view
  // (Approvers view through /inbox/[id])
  if (app.applicant_login_id !== session.login_id) {
    notFound();
  }

  const steps = app.chain_snapshot;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-16">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link
            href="/"
            className="text-sm font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1.5"
          >
            ← Back to My Applications
          </Link>
          <span className="text-xs bg-slate-100 text-slate-600 font-mono px-2 py-0.5 rounded">
            ID: {app.id.slice(0, 8)}...
          </span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Status Banner */}
        <div className="bg-white border border-slate-200 rounded-lg p-6 mb-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
            <div>
              <div className="flex items-center gap-2 mb-1">
                {app.urgent && (
                  <span className="bg-rose-100 text-rose-700 text-xs font-bold px-2 py-0.5 rounded uppercase">
                    Urgent
                  </span>
                )}
                <h1 className="text-xl font-bold text-slate-900">{app.subject}</h1>
              </div>
              <p className="text-xs text-slate-500">
                Submitted on {formatToIST(app.created_at)} • Type: Medical Leave
              </p>
            </div>

            <div className="shrink-0">
              {app.status === "in_review" && (
                <div className="bg-amber-50 border border-amber-200 text-amber-900 px-3 py-1.5 rounded-md text-xs font-semibold">
                  In Review (Step {app.current_step + 1} of {steps.length})
                  {app.current_approver && (
                    <span className="block text-[11px] font-normal text-amber-800 mt-0.5">
                      Waiting for: {app.current_approver.name}
                    </span>
                  )}
                </div>
              )}
              {app.status === "approved" && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 px-4 py-2 rounded-md text-xs font-bold">
                  ✓ Final Approved
                </div>
              )}
              {app.status === "rejected" && (
                <div className="bg-rose-50 border border-rose-200 text-rose-900 px-4 py-2 rounded-md text-xs font-bold">
                  ✕ Application Rejected
                </div>
              )}
              {app.status === "returned" && (
                <div className="bg-indigo-50 border border-indigo-200 text-indigo-900 px-4 py-2 rounded-md text-xs font-bold">
                  ↩ Returned for Correction
                </div>
              )}
            </div>
          </div>

          {/* Workflow Step Progression Bar */}
          <div className="pt-6">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">
              Approval Chain Progress
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {steps.map((step, idx) => {
                const isCompleted =
                  app.status === "approved" ||
                  idx < app.current_step ||
                  (app.status === "in_review" && idx < app.current_step);
                const isCurrent = app.status === "in_review" && idx === app.current_step;
                const isPending = idx > app.current_step;

                return (
                  <div
                    key={step.step_key}
                    className={`border rounded-lg p-4 transition ${
                      isCurrent
                        ? "border-amber-400 bg-amber-50/50 shadow-sm"
                        : isCompleted
                        ? "border-emerald-300 bg-emerald-50/30"
                        : "border-slate-200 bg-slate-50 opacity-60"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-slate-700">
                        Step {idx + 1}: {step.label}
                      </span>
                      {isCompleted && (
                        <span className="text-[11px] font-bold text-emerald-700">✓ Done</span>
                      )}
                      {isCurrent && (
                        <span className="text-[11px] font-bold text-amber-700">● In Progress</span>
                      )}
                      {isPending && (
                        <span className="text-[11px] font-medium text-slate-400">Pending</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">
                      Resolver: {step.resolver.kind.replace("_", " ")}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Applicant Snapshot & Additional Info */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="md:col-span-1 bg-white border border-slate-200 rounded-lg p-5">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
              Applicant Snapshot
            </h3>
            <div className="space-y-2 text-xs">
              <div>
                <span className="text-slate-400 block">Name</span>
                <span className="font-semibold text-slate-900">{app.applicant_snapshot.name}</span>
              </div>
              <div>
                <span className="text-slate-400 block">PRN</span>
                <span className="font-mono text-slate-800">{app.applicant_snapshot.login_id}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Department & Batch</span>
                <span className="text-slate-800">
                  {app.applicant_snapshot.department} • {app.applicant_snapshot.batch || "2024-28"}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Semester & Section</span>
                <span className="text-slate-800">
                  Semester {app.applicant_snapshot.semester || 1} (Sec {app.applicant_snapshot.section || "A"})
                </span>
              </div>
            </div>
          </div>

          {/* Attachments List */}
          <div className="md:col-span-2 bg-white border border-slate-200 rounded-lg p-5">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
              Attached Documents ({app.attachments.length})
            </h3>
            {app.attachments.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No attachments provided.</p>
            ) : (
              <div className="space-y-2">
                {app.attachments.map((att) => (
                  <AttachmentItem
                    key={att.id}
                    id={att.id}
                    originalName={att.original_name}
                    sizeBytes={att.size_bytes}
                    mime={att.mime}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* History / Audit Log with Digital Verification Stamps */}
        <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">
            Application History & Verification Stamps
          </h3>

          <div className="space-y-6">
            {app.steps.map((step) => (
              <div
                key={step.id}
                className="border-l-2 border-slate-200 pl-4 py-1 relative space-y-1.5"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-900">
                    {step.decision}
                  </span>
                  <span className="text-xs text-slate-500">by {step.actor_login_id}</span>
                  <span className="text-xs text-slate-400">• {formatToIST(step.at)}</span>
                </div>

                {step.comment && (
                  <p className="text-xs bg-slate-50 border border-slate-100 p-2.5 rounded text-slate-800">
                    &ldquo;{step.comment}&rdquo;
                  </p>
                )}

                {/* Digital Verification Stamp */}
                {step.verification_id && (
                  <div className="mt-2">
                    <VerifiedStamp
                      name={step.actor_login_id}
                      designation={step.step_key}
                      verificationId={step.verification_id}
                      timestamp={step.at}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
