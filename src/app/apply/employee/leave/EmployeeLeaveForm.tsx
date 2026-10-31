"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AttachmentUploader, type UploadedFileItem } from "@/components/AttachmentUploader";
import { formatISOtoDDMMYYYY } from "@/lib/dates";

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
  const todayIST = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
  }).format(new Date());

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
    if (!fromDate) {
      setPreview(null);
      setPreviewError(null);
      return;
    }

    if (fromDate.trim() < todayIST) {
      setPreview(null);
      setPreviewError("Past dates are not allowed for leave applications. Please select today or a future date.");
      return;
    }

    const effectiveToDate = toDate.trim() || fromDate.trim();

    const timer = setTimeout(async () => {
      setPreviewLoading(true);
      setPreviewError(null);

      try {
        const res = await fetch("/api/leave/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            from_date: fromDate.trim(),
            to_date: effectiveToDate,
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
    }, 300);

    return () => clearTimeout(timer);
  }, [fromDate, toDate, leaveType, todayIST]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!fromDate.trim()) {
      setSubmitError("Please select Leave From Date");
      return;
    }

    if (fromDate.trim() < todayIST) {
      setSubmitError("Past dates are not allowed for leave applications. Please select today or a future date.");
      return;
    }

    const effectiveToDate = toDate.trim() || fromDate.trim();

    if (effectiveToDate < fromDate.trim()) {
      setSubmitError("Leave To Date cannot be earlier than From Date");
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
      setSubmitError("Selected date range contains 0 working days (all selected days are off-days or holidays)");
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
          to_date: effectiveToDate,
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
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-md text-sm font-medium">
          {submitError}
        </div>
      )}

      {/* Leave Type Dropdown */}
      <div>
        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
          Leave Type <span className="text-red-600 font-bold ml-1">*</span>
        </label>
        <select
          value={leaveType}
          onChange={(e) => setLeaveType(e.target.value as "personal" | "medical")}
          className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-md text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 cursor-pointer shadow-xs"
        >
          <option value="personal">Personal Leave (Casual, personal &amp; family matters)</option>
          <option value="medical">Medical Leave (Doctor consultation, illness &amp; recovery)</option>
        </select>
      </div>

      {/* Date Pickers with Visual Calendar Picker */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
            Leave From Date <span className="text-red-600 font-bold ml-1">*</span>
          </label>
          <input
            type="date"
            value={fromDate}
            min={todayIST}
            onChange={(e) => setFromDate(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 cursor-pointer shadow-2xs"
            required
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Leave To Date
            </label>
            <span className="text-[11px] text-slate-400 font-normal">
              (Optional — leave blank for 1 day)
            </span>
          </div>
          <input
            type="date"
            value={toDate}
            min={fromDate || todayIST}
            onChange={(e) => setToDate(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 cursor-pointer shadow-2xs"
          />
        </div>
      </div>

      {/* Dynamic Working Days & Balance Calculation Preview */}
      {previewLoading && (
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-500 italic">
          Calculating working days, off-days, and leave balance...
        </div>
      )}

      {previewError && (
        <div className="p-3 bg-amber-50 border border-amber-300 text-amber-900 rounded-lg text-xs font-medium">
          ⚠️ {previewError}
        </div>
      )}

      {preview && (
        <div className="bg-slate-50 border-2 border-slate-900 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 block">
                Leave Duration
              </span>
              <span className="text-base font-bold text-slate-900">
                {preview.working_days} Working Day{preview.working_days === 1 ? "" : "s"}
              </span>
              <span className="text-xs text-slate-500 ml-1.5 font-medium">
                ({fromDate === (toDate.trim() || fromDate)
                  ? formatISOtoDDMMYYYY(fromDate)
                  : `${formatISOtoDDMMYYYY(fromDate)} to ${formatISOtoDDMMYYYY(toDate.trim() || fromDate)}`})
              </span>
            </div>

            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">
                Current {leaveType === "medical" ? "Medical" : "Personal"} Balance
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

          {/* Clean balance summary without paid/unpaid confusion */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 text-center text-xs">
            <div className="bg-white p-2.5 rounded border border-slate-200">
              <span className="block text-[11px] text-slate-500 font-medium">Current Balance</span>
              <span className="text-sm font-bold text-slate-900 font-mono">{preview.current_balance} days</span>
            </div>

            <div className="bg-emerald-50 p-2.5 rounded border border-emerald-200">
              <span className="block text-[11px] text-emerald-800 font-medium">Leave Requested</span>
              <span className="text-sm font-bold text-emerald-950 font-mono">{preview.working_days} day{preview.working_days === 1 ? "" : "s"}</span>
            </div>

            <div className="bg-white p-2.5 rounded border border-slate-200 col-span-2 sm:col-span-1">
              <span className="block text-[11px] text-slate-500 font-medium">Balance After</span>
              <span className="text-sm font-bold text-slate-900 font-mono">{preview.balance_after} days</span>
            </div>
          </div>

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
          Reason for Leave <span className="text-red-600 font-bold ml-1">*</span>
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
          className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-md text-sm font-semibold shadow-sm transition cursor-pointer"
        >
          {submitting ? "Submitting..." : "Submit Leave Application"}
        </button>
      </div>
    </form>
  );
}
