import { notFound } from "next/navigation";
import Link from "next/link";
import { getDb } from "@/lib/db";
import { formatToIST } from "@/lib/date";

export default async function VerifyStampPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const decodedId = decodeURIComponent(id).trim();

  const db = getDb();

  // Search by verification_id (e.g. AP-XXXX-XXXX) or by application_id
  const { data: step } = await db
    .from("application_steps")
    .select(`
      verification_id,
      step_key,
      decision,
      actor_login_id,
      at,
      comment,
      application_id,
      applications:application_id (
        id,
        type,
        subject,
        status
      )
    `)
    .or(`verification_id.eq.${decodedId},application_id.eq.${decodedId}`)
    .maybeSingle();

  if (!step || !step.verification_id) {
    notFound();
  }

  // Look up actor person details
  const { data: actor } = await db
    .from("people")
    .select("name, designation, department, eklink_role")
    .eq("login_id", step.actor_login_id)
    .maybeSingle();

  const app = Array.isArray(step.applications)
    ? step.applications[0]
    : step.applications;

  const isApproved = step.decision === "approved" || step.decision === "forwarded";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans py-12 px-4 flex items-center justify-center">
      <div className="max-w-md w-full bg-white border border-slate-200 rounded-xl p-8 shadow-sm text-center">
        {/* SIT Nagpur Header */}
        <div className="mb-6 border-b border-slate-100 pb-5">
          <div className="w-12 h-12 bg-slate-900 text-white rounded-full flex items-center justify-center mx-auto mb-2 font-bold text-lg">
            SIT
          </div>
          <h1 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            Symbiosis Institute of Technology
          </h1>
          <p className="text-xs text-slate-500">
            Nagpur Campus • Electronic Verification Portal
          </p>
        </div>

        {/* Verification Status Badge */}
        <div className="mb-6">
          <div
            className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3 ring-4 ${
              isApproved
                ? "bg-emerald-600 text-white ring-emerald-100"
                : "bg-rose-600 text-white ring-rose-100"
            }`}
          >
            {isApproved ? (
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
          </div>
          <h2 className="text-lg font-bold text-slate-900">
            {isApproved ? "Official Verification Verified" : "Decision Recorded (Rejected)"}
          </h2>
          <p className="font-mono text-xs text-indigo-700 font-bold mt-1 tracking-wider">
            ID: {step.verification_id}
          </p>
        </div>

        {/* Details List */}
        <div className="text-left text-xs bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2.5 mb-6">
          <div>
            <span className="text-slate-400 block">Verified By Authority:</span>
            <span className="font-bold text-slate-900 text-sm">
              {actor?.name || step.actor_login_id}
            </span>
            <span className="text-slate-500 block">
              {actor?.designation || actor?.eklink_role || "Faculty"} • {actor?.department || "SIT Nagpur"}
            </span>
          </div>

          <div>
            <span className="text-slate-400 block">Role / Step in Workflow:</span>
            <span className="font-semibold text-slate-800 capitalize">
              {step.step_key.replace("_", " ")} ({step.decision})
            </span>
          </div>

          <div>
            <span className="text-slate-400 block">Timestamp:</span>
            <span className="font-medium text-slate-800">{formatToIST(step.at)}</span>
          </div>

          {app && (
            <div className="pt-2 border-t border-slate-200">
              <span className="text-slate-400 block">Associated Application:</span>
              <span className="font-semibold text-slate-900 block truncate">
                {app.subject}
              </span>
              <span className="text-[11px] text-slate-500">
                Type: {app.type.toUpperCase()} • Overall Status: {app.status.toUpperCase()}
              </span>
            </div>
          )}
        </div>

        {/* Legal Disclaimer */}
        <p className="text-[10px] text-slate-400 leading-tight mb-4">
          Internal electronic record. Not a legal digital signature. Issued under SIT Nagpur ApproveIt Paperless Workflow.
        </p>

        <Link
          href="/"
          className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold"
        >
          ← Return to ApproveIt Portal
        </Link>
      </div>
    </div>
  );
}
