"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AttachmentUploader, type UploadedFileItem } from "@/components/AttachmentUploader";
import { formatISOtoDDMMYYYY, parseDDMMYYYYtoISO } from "@/lib/dates";

interface PreviewData {
  working_days: number;
  total_days: number;
  excluded_days: Array<{ date: string; reason: string; description?: string }>;
  current_balance: number;
  deducted: number;
  unpaid: number;
  balance_after: number;
  has_overlap: boolean;
  conflicting_application_id?: string;
}

export function EmployeeLeaveForm() {
  const router = useRouter();
  const [leaveType, setLeaveType] = useState<"medical" | "personal">("personal");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [reason, setReason] = useState("");
  const [attachments, setAttachments] = useState<UploadedFileItem[]>([]);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Trigger preview when fromDate, toDate, or leaveType change
  useEffect(() => {
    if (!fromDate || !toDate) {
      setPreview(null);
      setPreviewError(null);
      return;
    }

    const timer = setTimeout(async () => {
      setPreviewLoading(true);
      setPreviewError(null);

      try {
        const res = await fetch("/api/leave/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            from_date: fromDate.trim(),
            to_date: toDate.trim(),
            leave_type: leaveType,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          setPreviewError(data.error || "Could not calculate working days");
          setPreview(null);
        } else {
          setPreview(data);
          setPreviewError(null);
        }
      } catch {
        setPreviewError("Network error while calculating leave preview");
        setPreview(null);
      } finally {
        setPreviewLoading(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [fromDate, toDate, leaveType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!fromDate.trim() || !toDate.trim()) {
      setSubmitError("Please select both From Date and To Date");
      return;
    }

    if (!reason.trim()) {
      setSubmitError("Please provide a reason for your leave request");
      return;
    }

    if (preview?.has_overlap) {
      setSubmitError("Dates conflict with an existing active application");
      return;
    }

    if (preview && preview.working_days === 0) {
      setSubmitError("Selected date range contains 0 working days");
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch("/api/applications/employee/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leave_type: leaveType,
          from_date: fromDate.trim(),
          to_date: toDate.trim(),
          reason: reason.trim(),
          comment: reason.trim(),
          attachments: attachments.map((a) => ({
            storage_path: a.storage_path,
            original_name: a.original_name,
            size_bytes: a.size_bytes,
            mime: a.mime,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error || "Failed to submit leave application");
        setSubmitting(false);
        return;
      }

      router.push(`/applications/${data.id}`);
      router.refresh();
    } catch {
      setSubmitError("An unexpected network error occurred");
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {submitError && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-md text-sm">
          {submitError}
        </div>
      )}

      {/* Leave Type Toggle */}
      <div>
        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
          Leave Type *
        </label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setLeaveType("personal")}
            className={`p-3 rounded-lg border text-left transition ${
              leaveType === "personal"
                ? "bg-slate-900 border-slate-900 text-white"
                : "bg-white border-slate-300 text-slate-700 hover:bg-slate-50"
            }`}
          >
            <span className="font-bold text-sm block">Personal Leave</span>
            <span className={`text-xs block mt-0.5 ${leaveType === "personal" ? "text-slate-300" : "text-slate-500"}`}>
              Casual &amp; personal affairs
            </span>
          </button>

          <button
            type="button"
            onClick={() => setLeaveType("medical")}
            className={`p-3 rounded-lg border text-left transition ${
              leaveType === "medical"
                ? "bg-slate-900 border-slate-900 text-white"
                : "bg-white border-slate-300 text-slate-700 hover:bg-slate-50"
            }`}
          >
            <span className="font-bold text-sm block">Medical Leave</span>
            <span className={`text-xs block mt-0.5 ${leaveType === "medical" ? "text-slate-300" : "text-slate-500"}`}>
              Illness or medical recovery
            </span>
          </button>
        </div>
      </div>

      {/* Date Pickers */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
            Leave From Date (DD-MM-YYYY) *
          </label>
          <input
            type="text"
            placeholder="DD-MM-YYYY"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
            Leave To Date (DD-MM-YYYY) *
          </label>
          <input
            type="text"
            placeholder="DD-MM-YYYY"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
            required
          />
        </div>
      </div>

      {/* Dynamic Working Days & Balance Calculation Preview */}
      {previewLoading && (
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-500 italic">
          Calculating working days, holidays, and leave balance...
        </div>
      )}

      {previewError && (
        <div className="p-3 bg-amber-50 border border-amber-300 text-amber-900 rounded-lg text-xs">
          ⚠️ {previewError}
        </div>
      )}

      {preview && (
        <div className="bg-slate-50 border-2 border-slate-900 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 block">
                Working Days Calculation
              </span>
              <span className="text-base font-bold text-slate-900">
                {preview.working_days} Working Day(s)
              </span>
              <span className="text-xs text-slate-500 ml-1.5 font-medium">
                ({preview.total_days} Total Days)
              </span>
            </div>

            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">
                Available {leaveType} Balance
              </span>
              <span className="text-base font-mono font-bold text-slate-900">
                {preview.current_balance} days
              </span>
            </div>
          </div>

          {preview.excluded_days.length > 0 && (
            <div className="text-xs text-slate-600">
              <span className="font-semibold text-slate-700">Excluded off-days ({preview.excluded_days.length}):</span>{" "}
              {preview.excluded_days.map((ex) => (
                <span key={ex.date} className="inline-block bg-white border border-slate-200 text-slate-700 px-2 py-0.5 rounded mr-1 mt-1 font-mono text-[11px]">
                  {formatISOtoDDMMYYYY(ex.date)} ({ex.description || ex.reason})
                </span>
              ))}
            </div>
          )}

          {/* Balance projection breakdown */}
          <div className="grid grid-cols-3 gap-2 pt-2 text-center text-xs">
            <div className="bg-emerald-100/60 p-2 rounded border border-emerald-300">
              <span className="block text-[11px] text-emerald-900 font-medium">Paid Deduction</span>
              <span className="text-sm font-bold text-emerald-950 font-mono">{preview.deducted} days</span>
            </div>

            <div className={`p-2 rounded border ${preview.unpaid > 0 ? "bg-rose-100/70 border-rose-300" : "bg-white border-slate-200"}`}>
              <span className={`block text-[11px] font-medium ${preview.unpaid > 0 ? "text-rose-900 font-bold" : "text-slate-600"}`}>
                Unpaid Leave
              </span>
              <span className={`text-sm font-bold font-mono ${preview.unpaid > 0 ? "text-rose-950 font-black" : "text-slate-900"}`}>
                {preview.unpaid} days
              </span>
            </div>

            <div className="bg-white p-2 rounded border border-slate-200">
              <span className="block text-[11px] text-slate-600 font-medium">Balance After</span>
              <span className="text-sm font-bold text-slate-900 font-mono">{preview.balance_after} days</span>
            </div>
          </div>

          {/* Unpaid Warning Banner */}
          {preview.unpaid > 0 && (
            <div className="p-2.5 bg-rose-50 border border-rose-300 rounded text-xs text-rose-900 flex items-center gap-2">
              <span className="text-base">⚠️</span>
              <span>
                <strong>Insufficient Leave Balance:</strong> You have only {preview.current_balance} days available. {preview.unpaid} working days will be recorded as <strong>UNPAID LEAVE</strong> upon approval.
              </span>
            </div>
          )}

          {/* Overlap Conflict Banner */}
          {preview.has_overlap && (
            <div className="p-2.5 bg-red-100 border border-red-400 rounded text-xs text-red-950 font-semibold flex items-center gap-2">
              <span className="text-base">🚫</span>
              <span>
                Conflict: You already have an active leave application overlapping these dates (ID: {preview.conflicting_application_id}).
              </span>
            </div>
          )}
        </div>
      )}

      <div>
        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
          Reason for Leave *
        </label>
        <textarea
          rows={4}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="State the reason for your leave request in detail..."
          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
          required
        />
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
          Medical Certificate / Supporting Proofs (Optional)
        </label>
        <AttachmentUploader
          attachments={attachments}
          onChange={setAttachments}
        />
      </div>

      <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
        <Link
          href="/"
          className="px-4 py-2 border border-slate-300 rounded-md text-sm font-semibold text-slate-700 hover:bg-slate-100 transition"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={submitting || (preview?.has_overlap ?? false) || (preview?.working_days === 0)}
          className="px-5 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-md text-sm font-semibold shadow-sm transition"
        >
          {submitting ? "Submitting..." : "Submit Leave Application"}
        </button>
      </div>
    </form>
  );
}
