"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface ReviewActionsProps {
  applicationId: string;
  stepConfig?: {
    can_reject?: boolean;
    can_return?: boolean;
    attendance_required?: boolean;
    comment_required_on_forward?: boolean;
    decision_label?: string;
    label?: string;
  } | null;
}

export function ReviewActions({ applicationId, stepConfig }: ReviewActionsProps) {
  const router = useRouter();
  const [comment, setComment] = useState("");
  const [attendance, setAttendance] = useState("");
  const [includeSignature, setIncludeSignature] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canReject = stepConfig?.can_reject !== false;
  const canReturn = stepConfig?.can_return !== false;
  const isForwardStep = stepConfig?.decision_label === "Forward" || !canReject;
  const attendanceRequired = stepConfig?.attendance_required ?? false;

  const handleAction = async (action: "approve" | "reject" | "return" | "forward") => {
    setError(null);

    if ((action === "reject" || action === "return") && !comment.trim()) {
      setError(
        action === "reject"
          ? "A comment or rejection reason is mandatory when rejecting."
          : "A comment explaining what needs correction is mandatory when returning."
      );
      return;
    }

    if (action === "forward" && stepConfig?.comment_required_on_forward && !comment.trim()) {
      setError("An attendance verification note or comment is mandatory when forwarding.");
      return;
    }

    let parsedAttendance: number | null = null;
    if (action === "forward" && attendanceRequired) {
      if (!attendance.trim()) {
        setError("Attendance percentage is mandatory before forwarding.");
        return;
      }
      const num = parseFloat(attendance.trim());
      if (isNaN(num) || num < 0 || num > 100) {
        setError("Please enter a valid attendance percentage between 0 and 100 (e.g. 85.50).");
        return;
      }
      parsedAttendance = parseFloat(num.toFixed(2));
    }

    setSubmitting(true);

    try {
      const res = await fetch(`/api/applications/${applicationId}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          comment: comment.trim() || null,
          include_signature: includeSignature,
          attendance_percentage: parsedAttendance,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to process decision");
        setSubmitting(false);
        return;
      }

      if (action === "approve" || action === "forward") {
        router.push("/inbox?tab=approved");
      } else if (action === "reject") {
        router.push("/inbox?tab=rejected");
      } else {
        router.push("/inbox?tab=returned");
      }
      router.refresh();
    } catch {
      setError("An unexpected network error occurred");
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white border-2 border-slate-900 rounded-lg p-6 shadow-sm">
      <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-2">
        Take Action on this Application
      </h3>
      <p className="text-xs text-slate-500 mb-4">
        Your decision will be permanently logged. A unique Digital Verification Stamp will be generated.
      </p>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs p-3 rounded mb-4">
          {error}
        </div>
      )}

      {/* Attendance percentage input box for admin staff */}
      {attendanceRequired && (
        <div className="mb-4 bg-indigo-50/70 border border-indigo-200 rounded-lg p-4">
          <label className="block text-xs font-bold text-indigo-950 mb-1">
            Verified Attendance Percentage (%) <span className="text-rose-600">*</span>
          </label>
          <div className="relative rounded-md shadow-2xs max-w-xs">
            <input
              type="number"
              step="0.01"
              min="0"
              max="100"
              required
              value={attendance}
              onChange={(e) => setAttendance(e.target.value)}
              placeholder="e.g. 85.50"
              className="w-full px-3 py-2 bg-white border border-indigo-300 rounded text-xs font-mono font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600 pr-8"
            />
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-indigo-700 text-xs font-bold">
              %
            </div>
          </div>
          <p className="text-[11px] text-indigo-800 mt-1.5">
            Enter official ERP attendance percentage (number up to 2 decimal places). This will be stamped into the permanent record.
          </p>
        </div>
      )}

      <div className="mb-4">
        <label className="block text-xs font-semibold text-slate-700 mb-1">
          {isForwardStep ? "Attendance Verification Remarks" : "Reviewer Comment / Instructions"}
          {(!canReject || stepConfig?.comment_required_on_forward) && (
            <span className="text-rose-600 font-bold ml-1">*</span>
          )}
        </label>
        <textarea
          rows={3}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={
            isForwardStep
              ? "Provide attendance verification notes or comments..."
              : "Provide instructions or approval/rejection remarks..."
          }
          className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white"
        />
      </div>

      {/* Checkbox option to include profile signature */}
      <div className="mb-5 bg-slate-50 border border-slate-200 rounded p-3">
        <label className="flex items-start gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={includeSignature}
            onChange={(e) => setIncludeSignature(e.target.checked)}
            className="w-4 h-4 mt-0.5 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
          />
          <div>
            <span className="text-xs font-semibold text-slate-800 block">
              Attach my uploaded signature from profile
            </span>
            <span className="text-[11px] text-slate-500">
              The digital verification seal with unique ID and timestamp will always be attached by default.
            </span>
          </div>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {/* If forward step, render Forward button */}
        {isForwardStep ? (
          <button
            type="button"
            disabled={submitting}
            onClick={() => handleAction("forward")}
            className="bg-indigo-700 hover:bg-indigo-800 disabled:opacity-50 text-white text-xs font-bold px-5 py-2.5 rounded shadow-sm transition flex items-center gap-1.5"
          >
            {submitting ? "Processing..." : "➡️ Verify & Forward to Incharge"}
          </button>
        ) : (
          <button
            type="button"
            disabled={submitting}
            onClick={() => handleAction("approve")}
            className="bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-bold px-4 py-2.5 rounded shadow-sm transition"
          >
            {submitting ? "Processing..." : "✓ Approve & Verify"}
          </button>
        )}

        {/* Return button if allowed */}
        {canReturn && (
          <button
            type="button"
            disabled={submitting}
            onClick={() => handleAction("return")}
            className="bg-slate-700 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-bold px-4 py-2.5 rounded shadow-sm transition"
          >
            {submitting ? "Processing..." : "↩ Hold / Return to Student"}
          </button>
        )}

        {/* Reject button if allowed */}
        {canReject && (
          <button
            type="button"
            disabled={submitting}
            onClick={() => handleAction("reject")}
            className="bg-rose-700 hover:bg-rose-800 disabled:opacity-50 text-white text-xs font-bold px-4 py-2.5 rounded shadow-sm transition"
          >
            {submitting ? "Processing..." : "✕ Reject Application"}
          </button>
        )}
      </div>
    </div>
  );
}
