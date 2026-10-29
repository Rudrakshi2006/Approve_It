"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ReviewActions({ applicationId }: { applicationId: string }) {
  const router = useRouter();
  const [comment, setComment] = useState("");
  const [includeSignature, setIncludeSignature] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAction = async (action: "approve" | "reject" | "return") => {
    setError(null);

    if ((action === "reject" || action === "return") && !comment.trim()) {
      setError(
        action === "reject"
          ? "A comment or rejection reason is mandatory when rejecting."
          : "A comment explaining what needs correction is mandatory when returning."
      );
      return;
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
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to process decision");
        setSubmitting(false);
        return;
      }

      if (action === "approve") {
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
        Your decision will be permanently logged. A unique Digital Verification Stamp (Green for Approve, Red for Reject) will be generated.
      </p>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs p-3 rounded mb-4">
          {error}
        </div>
      )}

      <div className="mb-4">
        <label className="block text-xs font-semibold text-slate-700 mb-1">
          Reviewer Comment / Instructions (Required for Reject &amp; Return)
        </label>
        <textarea
          rows={3}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Provide instructions or approval/rejection remarks..."
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
        <button
          type="button"
          disabled={submitting}
          onClick={() => handleAction("approve")}
          className="bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-bold px-4 py-2.5 rounded shadow-sm transition"
        >
          {submitting ? "Processing..." : "✓ Approve & Verify"}
        </button>

        <button
          type="button"
          disabled={submitting}
          onClick={() => handleAction("return")}
          className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold px-4 py-2.5 rounded shadow-sm transition"
        >
          {submitting ? "Processing..." : "↩ Hold / Return to Student"}
        </button>

        <button
          type="button"
          disabled={submitting}
          onClick={() => handleAction("reject")}
          className="bg-rose-700 hover:bg-rose-800 disabled:opacity-50 text-white text-xs font-bold px-4 py-2.5 rounded shadow-sm transition"
        >
          {submitting ? "Processing..." : "✕ Reject Application"}
        </button>
      </div>
    </div>
  );
}
