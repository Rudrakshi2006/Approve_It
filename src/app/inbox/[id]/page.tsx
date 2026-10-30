import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { requirePageSession } from "@/lib/auth";
import { getApplicationById } from "@/lib/repos/applications";
import { getDb } from "@/lib/db";
import { formatToIST, formatDatesInText } from "@/lib/date";
import { buildUnifiedTimeline } from "@/lib/thread";
import { createSignatureSignedUrl } from "@/lib/signature";
import { AttachmentItem } from "@/app/applications/[id]/AttachmentItem";
import { ReviewActions } from "./ReviewActions";
import { UnifiedThread } from "@/components/UnifiedThread";

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

  const db = getDb();

  // Load thread messages
  const { data: messages } = await db
    .from("application_messages")
    .select("*")
    .eq("application_id", app.id)
    .order("created_at", { ascending: true });

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

  // Check if current user has an uploaded signature
  const { data: currentUserPerson } = await db
    .from("people")
    .select("signature_path")
    .eq("login_id", session.login_id)
    .maybeSingle();

  const hasSignature = Boolean(currentUserPerson?.signature_path);

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

  // Generate signed URLs for approver signatures
  const signatureUrls: Record<string, string> = {};
  for (const step of app.steps) {
    if (step.signature_path && !signatureUrls[step.signature_path]) {
      const url = await createSignatureSignedUrl(step.signature_path);
      if (url) signatureUrls[step.signature_path] = url;
    }
  }

  const timeline = buildUnifiedTimeline(app.steps, messages || [], app.attachments);
  const canReply = app.status === "in_review" || app.status === "returned";

  const typeLabels: Record<string, string> = {
    medical: "Medical Leave",
    hackathon: "Hackathon & Competition",
    re_ca: "Re-Continuous Assessment (Re-CA)",
    general: "General Application",
  };

  // Check if admin staff forwarded attendance
  const adminStaffForwarded = app.steps.find(
    (s) => s.step_key === "admin_staff" && s.decision === "forwarded"
  );
  const attendanceMatch = adminStaffForwarded?.comment?.match(/Attendance:\s*([0-9.]+%?)/i);
  const attendanceDisplay = attendanceMatch ? attendanceMatch[1] : null;

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
                    ⚡ Urgent
                  </span>
                )}
                <h1 className="text-xl font-bold text-slate-900">{formatDatesInText(app.subject)}</h1>
              </div>
              <p className="text-xs text-slate-500">
                Submitted on {formatToIST(app.created_at)} • Type: {typeLabels[app.type] || app.type}
              </p>
            </div>

            <div className="shrink-0 flex items-center gap-2.5">
              {app.status === "in_review" && (
                <div className="bg-amber-50 border border-amber-200 text-amber-900 px-3.5 py-2 rounded-md text-xs shadow-xs">
                  {isCurrentApprover ? (
                    <div className="flex items-center gap-1.5 font-bold text-amber-900">
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                      Pending Your Action ({app.chain_snapshot[app.current_step]?.label || "Approver"})
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center gap-1.5 font-bold text-amber-900">
                        <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                        Forwarded to: {actorNames[app.current_approver_login_id || ""] || app.current_approver?.name || "Next Approver"}
                      </div>
                      <span className="block text-[11px] font-medium text-amber-700 mt-0.5">
                        {app.chain_snapshot[app.current_step]?.label || "Next Step"}
                      </span>
                    </div>
                  )}
                </div>
              )}
              {app.status === "approved" && (
                <div className="flex items-center gap-2.5">
                  <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 px-3.5 py-1.5 rounded-md text-xs font-bold">
                    ✓ Approved
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
                  ✕ Rejected
                </div>
              )}
              {app.status === "returned" && (
                <div className="bg-indigo-50 border border-indigo-200 text-indigo-900 px-4 py-2 rounded-md text-xs font-bold">
                  ↩ Returned
                </div>
              )}
              {app.status === "cancelled" && (
                <div className="bg-slate-100 border border-slate-300 text-slate-700 px-4 py-2 rounded-md text-xs font-bold">
                  Withdrawn / Cancelled
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

            {/* Student Note / Remarks */}
            {app.payload?.comment ? (
              <div className="mt-4 p-4 bg-amber-50/80 border border-amber-200 rounded-lg">
                <span className="text-xs font-bold text-amber-950 uppercase tracking-wider block mb-1">
                  📝 Student Note / Reason:
                </span>
                <p className="text-xs text-amber-900 whitespace-pre-wrap leading-relaxed">
                  {String(app.payload.comment)}
                </p>
              </div>
            ) : null}
          </div>
        </div>

        {/* PROMINENT VERIFIED ATTENDANCE CARD (From Admin Staff) */}
        {adminStaffForwarded && (
          <div className="bg-emerald-50 border-2 border-emerald-500 rounded-lg p-5 mb-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-lg shrink-0 shadow-sm">
                  ✓
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-emerald-950 uppercase tracking-wider">
                      Verified ERP Attendance
                    </span>
                    {attendanceDisplay && (
                      <span className="bg-emerald-700 text-white text-xs font-black px-2.5 py-0.5 rounded shadow-xs font-mono">
                        {attendanceDisplay.includes("%") ? attendanceDisplay : `${attendanceDisplay}%`}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-emerald-900 font-medium mt-0.5">
                    Verified and forwarded by{" "}
                    <span className="font-bold">
                      {actorNames[adminStaffForwarded.actor_login_id] || adminStaffForwarded.actor_login_id}
                    </span>{" "}
                    (Administration Staff)
                  </p>
                  {adminStaffForwarded.comment && adminStaffForwarded.comment.includes("|") && (
                    <p className="text-xs text-slate-600 italic mt-1">
                      Staff Note: &ldquo;{adminStaffForwarded.comment.split("|").slice(1).join("|").trim()}&rdquo;
                    </p>
                  )}
                </div>
              </div>

              {adminStaffForwarded.verification_id && (
                <div className="text-right shrink-0 bg-white border border-emerald-200 px-3 py-1.5 rounded-md">
                  <span className="text-[10px] text-slate-400 block uppercase font-mono tracking-wider">
                    Digital Stamp
                  </span>
                  <span className="font-mono text-xs font-bold text-emerald-900">
                    {adminStaffForwarded.verification_id}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ATTACHMENTS SECTION (Placed BEFORE Action Box for easy review) */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 mb-6 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <span>Attached Documents &amp; Proofs</span>
              <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full text-[11px] font-bold">
                {app.attachments.length}
              </span>
            </h3>
          </div>

          {app.attachments.length === 0 ? (
            <div className="bg-slate-50 border border-dashed border-slate-200 rounded-md p-4 text-center">
              <p className="text-xs text-slate-400 italic">
                No attachments uploaded by applicant for this request.
              </p>
            </div>
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

        {/* Action Box */}
        {isCurrentApprover && app.status === "in_review" ? (
          <div className="mb-6">
            <ReviewActions
              applicationId={app.id}
              hasSignature={hasSignature}
              stepConfig={app.chain_snapshot[app.current_step]}
            />
          </div>
        ) : (
          <div className="bg-slate-100 border border-slate-200 rounded-lg p-4 mb-6 text-xs text-slate-600">
            ℹ️ You are viewing this application in read-only mode ({app.status === "in_review" ? "Awaiting another reviewer" : `Status: ${app.status}`}).
          </div>
        )}

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
