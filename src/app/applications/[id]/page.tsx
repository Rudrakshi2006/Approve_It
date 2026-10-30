import { notFound } from "next/navigation";
import Link from "next/link";
import { requirePageSession } from "@/lib/auth";
import { getApplicationById } from "@/lib/repos/applications";
import { getDb } from "@/lib/db";
import { formatToIST, formatDatesInText } from "@/lib/date";
import { buildUnifiedTimeline } from "@/lib/thread";
import { createSignatureSignedUrl } from "@/lib/signature";
import { AttachmentItem } from "./AttachmentItem";
import { ReturnedEditActions, WithdrawOnlyAction } from "./ReturnedEditActions";
import { UnifiedThread } from "@/components/UnifiedThread";

export default async function ApplicationStatusPage(props: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePageSession();
  const { id } = await props.params;

  const app = await getApplicationById(id);

  if (!app) {
    notFound();
  }

  // Authorization check: only applicant can view this student tracking view
  if (app.applicant_login_id !== session.login_id) {
    notFound();
  }

  const steps = app.chain_snapshot;
  const db = getDb();

  // Load thread messages
  const { data: messages } = await db
    .from("application_messages")
    .select("*")
    .eq("application_id", app.id)
    .order("created_at", { ascending: true });

  // Generate signed URLs for approver signatures
  const signatureUrls: Record<string, string> = {};
  for (const step of app.steps) {
    if (step.signature_path && !signatureUrls[step.signature_path]) {
      const url = await createSignatureSignedUrl(step.signature_path);
      if (url) signatureUrls[step.signature_path] = url;
    }
  }

  // Resolve real actor names for all participants in steps & messages
  const allActorIds = Array.from(
    new Set([
      ...app.steps.map((s) => s.actor_login_id),
      ...(messages || []).map((m: { author_login_id: string }) => m.author_login_id),
      app.applicant_login_id,
      ...(app.current_approver_login_id ? [app.current_approver_login_id] : []),
    ])
  );

  const { data: peopleRows } = await db
    .from("people")
    .select("login_id, name")
    .in("login_id", allActorIds);

  const actorNames: Record<string, string> = {};
  for (const p of peopleRows || []) {
    actorNames[p.login_id] = p.name;
  }

  // Determine mention candidates (strictly limited to people involved up to current step)
  const ROLE_DISPLAY_NAMES: Record<string, string> = {
    admin_staff: "Administration Staff",
    hackathon_incharge: "Hackathon Incharge",
    class_teacher: "Class Teacher",
    hod: "HOD",
    director: "Director",
    account_officer: "Accounts Officer",
  };

  const mentionCandidates: { login_id: string; name: string; roleLabel: string }[] = [];
  const seenCandidateIds = new Set<string>();

  // If viewer is NOT the applicant, add applicant
  if (session.login_id !== app.applicant_login_id) {
    seenCandidateIds.add(app.applicant_login_id);
    mentionCandidates.push({
      login_id: app.applicant_login_id,
      name: app.applicant_snapshot?.name || actorNames[app.applicant_login_id] || "Applicant",
      roleLabel: "Applicant Student",
    });
  }

  // Add approvers from completed steps
  for (const step of app.steps) {
    if (
      step.actor_login_id &&
      step.actor_login_id !== session.login_id &&
      !seenCandidateIds.has(step.actor_login_id)
    ) {
      seenCandidateIds.add(step.actor_login_id);
      const stepConfig = app.chain_snapshot ? app.chain_snapshot[step.step_index] : null;
      mentionCandidates.push({
        login_id: step.actor_login_id,
        name: actorNames[step.actor_login_id] || step.actor_login_id,
        roleLabel: stepConfig?.label || ROLE_DISPLAY_NAMES[step.step_key] || "Reviewer",
      });
    }
  }

  // Add current active approver if not viewer
  if (
    app.current_approver_login_id &&
    app.current_approver_login_id !== session.login_id &&
    !seenCandidateIds.has(app.current_approver_login_id)
  ) {
    seenCandidateIds.add(app.current_approver_login_id);
    const currStepConfig = app.chain_snapshot ? app.chain_snapshot[app.current_step] : null;
    mentionCandidates.push({
      login_id: app.current_approver_login_id,
      name: app.current_approver?.name || actorNames[app.current_approver_login_id] || "Approver",
      roleLabel: currStepConfig?.label || "Current Approver",
    });
  }

  const timeline = buildUnifiedTimeline(app.steps, messages || [], app.attachments);
  const canReply = app.status === "in_review" || app.status === "returned";

  const typeLabels: Record<string, string> = {
    medical: "Medical Leave",
    hackathon: "Hackathon & Competition",
    re_ca: "Re-Continuous Assessment (Re-CA)",
    general: "General Application",
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-16">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link
            href="/"
            className="text-sm font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1.5"
          >
            ← Back to Dashboard
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
                    ⚡ Urgent
                  </span>
                )}
                <h1 className="text-xl font-bold text-slate-900">{formatDatesInText(app.subject)}</h1>
              </div>
              <p className="text-xs text-slate-500">
                Submitted on {formatToIST(app.created_at)} • Type: {typeLabels[app.type] || app.type}
              </p>
            </div>

            <div className="shrink-0 flex items-center gap-3">
              {app.status === "in_review" && (
                <div className="bg-amber-50 border border-amber-200 text-amber-900 px-3.5 py-2 rounded-md text-xs shadow-xs">
                  <div className="flex items-center gap-1.5 font-bold">
                    <span className="inline-block w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                    Pending with: {app.current_approver?.name || actorNames[app.current_approver_login_id || ""] || "Approver"}
                  </div>
                  <span className="block text-[11px] font-medium text-amber-700 mt-0.5">
                    {app.chain_snapshot?.[app.current_step]?.label || "Next Reviewer"}
                  </span>
                </div>
              )}
              {app.status === "approved" && (
                <div className="flex items-center gap-2.5">
                  <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 px-3.5 py-1.5 rounded-md text-xs font-bold">
                    ✓ Final Approved
                  </div>
                  <a
                    href={`/api/applications/${app.id}/pdf`}
                    download
                    className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-3 py-1.5 rounded-md shadow-sm transition"
                  >
                    📄 Download PDF
                  </a>
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
              {app.status === "cancelled" && (
                <div className="bg-slate-100 border border-slate-300 text-slate-700 px-4 py-2 rounded-md text-xs font-bold">
                  Withdrawn / Cancelled
                </div>
              )}
            </div>
          </div>

          {/* Workflow Step Progression Bar */}
          <div className="pt-6">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">
              Approval Chain Progress
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {steps.map((step, idx) => {
                const isPassed = app.current_step > idx || app.status === "approved";
                const isCurrent = app.current_step === idx && app.status === "in_review";
                const isReturned = app.current_step === idx && app.status === "returned";
                const isRejected = app.current_step === idx && app.status === "rejected";

                return (
                  <div
                    key={step.step_key}
                    className={`p-3 rounded-lg border text-xs ${
                      isPassed
                        ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                        : isCurrent
                        ? "bg-amber-50 border-amber-300 text-amber-900 ring-2 ring-amber-400"
                        : isReturned
                        ? "bg-indigo-50 border-indigo-300 text-indigo-900 ring-2 ring-indigo-400"
                        : isRejected
                        ? "bg-rose-50 border-rose-200 text-rose-900"
                        : "bg-slate-50 border-slate-200 text-slate-500"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-[10px] uppercase tracking-wide">
                        Step {idx + 1}
                      </span>
                      {isPassed && <span className="text-emerald-700 font-bold">✓ Done</span>}
                      {isCurrent && <span className="text-amber-700 font-bold">● Active</span>}
                      {isReturned && <span className="text-indigo-700 font-bold">↩ Hold</span>}
                      {isRejected && <span className="text-rose-700 font-bold">✕ Rejected</span>}
                    </div>
                    <p className="font-semibold">{step.label}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Student Note / Remarks */}
          {app.payload?.comment ? (
            <div className="mt-5 p-4 bg-amber-50/80 border border-amber-200 rounded-lg">
              <span className="text-xs font-bold text-amber-950 uppercase tracking-wider block mb-1">
                📝 Your Submitted Reason / Note:
              </span>
              <p className="text-xs text-amber-900 whitespace-pre-wrap leading-relaxed">
                {String(app.payload.comment)}
              </p>
            </div>
          ) : null}
        </div>

        {/* Returned / Hold Edit Box (Test A8, A9) */}
        {app.status === "returned" && (
          <ReturnedEditActions
            applicationId={app.id}
            initialSubject={app.subject}
            initialComment={(app.payload?.comment as string) || ""}
            attachments={app.attachments.map((a) => ({
              id: a.id,
              original_name: a.original_name,
              size_bytes: a.size_bytes,
            }))}
          />
        )}

        {/* Withdraw Action: only allowed during Step 1 before it has been approved/forwarded */}
        {app.status === "in_review" && (
          <div className="mb-6">
            {app.current_step === 0 ? (
              <WithdrawOnlyAction applicationId={app.id} />
            ) : (
              <div className="inline-flex items-center gap-1.5 text-xs text-slate-500 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-md">
                <span>🔒</span>
                <span>Cannot be withdrawn (Step 1 verification already completed)</span>
              </div>
            )}
          </div>
        )}

        {/* Attachments Section */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 mb-6 shadow-sm">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
            Attached Documents ({app.attachments.length})
          </h3>
          {app.attachments.length === 0 ? (
            <p className="text-xs text-slate-400 italic">No attachments uploaded.</p>
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

        {/* Unified Timeline & Discussion Thread */}
        <UnifiedThread
          applicationId={app.id}
          timeline={timeline}
          canReply={canReply}
          signatureUrls={signatureUrls}
          actorNames={actorNames}
          mentionCandidates={mentionCandidates}
        />
      </main>
    </div>
  );
}
