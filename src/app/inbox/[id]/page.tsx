import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { requirePageSession } from "@/lib/auth";
import { getApplicationById } from "@/lib/repos/applications";
import { formatToIST } from "@/lib/date";
import { VerifiedStamp } from "@/components/VerifiedStamp";
import { AttachmentItem } from "@/app/applications/[id]/AttachmentItem";
import { ReviewActions } from "./ReviewActions";

export default async function ApproverReviewPage(props: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePageSession();

  if (session.eklink_role === "student") {
    redirect("/");
  }

  const { id } = await props.params;
  const app = await getApplicationById(id);

  if (!app) {
    notFound();
  }

  // Authorization check: User must be either the current designated approver OR have participated in steps
  const isCurrentApprover = app.current_approver_login_id === session.login_id;
  const hasParticipated = app.steps.some((s) => s.actor_login_id === session.login_id);

  if (!isCurrentApprover && !hasParticipated) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-16">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link
            href="/inbox"
            className="text-sm font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1.5"
          >
            ← Back to Inbox
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-xs bg-slate-100 text-slate-600 font-mono px-2 py-0.5 rounded">
              ID: {app.id.slice(0, 8)}...
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Application Header Card */}
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
                  Pending Decision (Step {app.current_step + 1} of {app.chain_snapshot.length})
                </div>
              )}
              {app.status === "approved" && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 px-4 py-2 rounded-md text-xs font-bold">
                  ✓ Approved
                </div>
              )}
              {app.status === "rejected" && (
                <div className="bg-rose-50 border border-rose-200 text-rose-900 px-4 py-2 rounded-md text-xs font-bold">
                  ✕ Rejected
                </div>
              )}
              {app.status === "returned" && (
                <div className="bg-indigo-50 border border-indigo-200 text-indigo-900 px-4 py-2 rounded-md text-xs font-bold">
                  ↩ Returned
                </div>
              )}
            </div>
          </div>

          {/* Student Snapshot Info */}
          <div className="pt-5">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
              Applicant Details (Frozen Snapshot)
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs bg-slate-50 p-4 rounded-md">
              <div>
                <span className="text-slate-400 block">Student Name</span>
                <span className="font-bold text-slate-900">{app.applicant_snapshot.name}</span>
              </div>
              <div>
                <span className="text-slate-400 block">PRN / Roll No</span>
                <span className="font-mono text-slate-800">{app.applicant_snapshot.login_id}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Dept &amp; Batch</span>
                <span className="text-slate-800 font-medium">
                  {app.applicant_snapshot.department} • {app.applicant_snapshot.batch || "2024-28"}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Semester &amp; Section</span>
                <span className="text-slate-800 font-medium">
                  Semester {app.applicant_snapshot.semester || 1} (Sec {app.applicant_snapshot.section || "A"})
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Box (Only if user is current approver and application is in review) */}
        {isCurrentApprover && app.status === "in_review" ? (
          <div className="mb-6">
            <ReviewActions applicationId={app.id} />
          </div>
        ) : (
          <div className="bg-slate-100 border border-slate-200 rounded-lg p-4 mb-6 text-xs text-slate-600">
            ℹ️ You are viewing this application in read-only mode ({app.status === "in_review" ? "Awaiting another reviewer" : `Status: ${app.status}`}).
          </div>
        )}

        {/* Attachments Section */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 mb-6 shadow-sm">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
            Attached Documents ({app.attachments.length})
          </h3>
          {app.attachments.length === 0 ? (
            <p className="text-xs text-slate-400 italic">No attachments uploaded by applicant.</p>
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

        {/* Previous Steps and Verification Stamps */}
        <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">
            Audit Trail &amp; Verification Stamps
          </h3>

          <div className="space-y-5">
            {app.steps.map((step) => (
              <div
                key={step.id}
                className="border-l-2 border-slate-200 pl-4 py-1 relative space-y-1.5"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-900">
                    {step.decision}
                  </span>
                  <span className="text-xs text-slate-600 font-medium">by {step.actor_login_id}</span>
                  <span className="text-xs text-slate-400">• {formatToIST(step.at)}</span>
                </div>

                {step.comment && (
                  <p className="text-xs bg-slate-50 border border-slate-100 p-2.5 rounded text-slate-800">
                    &ldquo;{step.comment}&rdquo;
                  </p>
                )}

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
