"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ReturnedEditActions({
  applicationId,
  initialSubject,
  initialComment,
  attachments,
}: {
  applicationId: string;
  initialSubject: string;
  initialComment?: string | null;
  attachments: { id: string; original_name: string; size_bytes: number }[];
}) {
  const router = useRouter();
  const [subject, setSubject] = useState(initialSubject);
  const [comment, setComment] = useState(initialComment || "");
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [resubmitting, setResubmitting] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [showWithdrawConfirm, setShowWithdrawConfirm] = useState(false);
  const [withdrawReason, setWithdrawReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Edit details
  const handleSaveDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSavedSuccess(false);

    try {
      const res = await fetch(`/api/applications/${applicationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: subject.trim(), comment: comment.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to update details");
      } else {
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 3000);
        router.refresh();
      }
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  };

  // Upload additional attachment
  const handleAddAttachment = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    setError(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("application_id", applicationId);

    try {
      const res = await fetch("/api/attachments/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        router.refresh();
      } else {
        setError(data.error || "Failed to upload file");
      }
    } catch {
      setError("Upload error");
    } finally {
      e.target.value = "";
    }
  };

  // Soft remove attachment
  const handleRemoveAttachment = async (attachId: string) => {
    setError(null);

    try {
      const res = await fetch(`/api/attachments/${attachId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        router.refresh();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to remove attachment");
      }
    } catch {
      setError("Network error");
    }
  };

  // Resubmit application (Test A9)
  const handleResubmit = async () => {
    setResubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/applications/${applicationId}/resubmit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment: "Resubmitted with requested corrections." }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to resubmit");
        setResubmitting(false);
      } else {
        router.refresh();
      }
    } catch {
      setError("Network error during resubmission");
      setResubmitting(false);
    }
  };

  // Withdraw application (Test A10)
  const handleWithdraw = async () => {
    setWithdrawing(true);
    setError(null);

    try {
      const res = await fetch(`/api/applications/${applicationId}/withdraw`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: withdrawReason.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to withdraw application");
        setWithdrawing(false);
      } else {
        router.refresh();
      }
    } catch {
      setError("Network error during withdrawal");
      setWithdrawing(false);
    }
  };

  return (
    <div className="bg-indigo-50 border-2 border-indigo-500 rounded-lg p-6 mb-6 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-indigo-950 uppercase tracking-wider">
          ↩ Action Required: Returned for Correction
        </h3>
        <button
          type="button"
          onClick={() => setShowWithdrawConfirm(true)}
          disabled={withdrawing}
          className="text-xs text-rose-600 hover:text-rose-800 font-semibold underline"
        >
          {withdrawing ? "Cancelling..." : "Withdraw Application"}
        </button>
      </div>

      {showWithdrawConfirm && (
        <div className="bg-rose-50 border border-rose-300 rounded-lg p-4 mb-4 text-xs space-y-2.5">
          <p className="font-bold text-rose-900">
            ⚠️ Confirm Withdrawal: Are you sure you want to withdraw this application?
          </p>
          <input
            type="text"
            value={withdrawReason}
            onChange={(e) => setWithdrawReason(e.target.value)}
            placeholder="Optional reason for withdrawal..."
            className="w-full p-2 border border-rose-200 rounded text-xs bg-white text-slate-800"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleWithdraw}
              disabled={withdrawing}
              className="bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold px-3 py-1.5 rounded transition shadow-xs"
            >
              {withdrawing ? "Withdrawing..." : "Yes, Withdraw Application"}
            </button>
            <button
              type="button"
              onClick={() => setShowWithdrawConfirm(false)}
              disabled={withdrawing}
              className="bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 font-medium px-3 py-1.5 rounded transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <p className="text-xs text-indigo-900 mb-4">
        Your reviewer returned this application. You can edit the subject/remarks, attach requested documents, remove incorrect files, and resubmit.
      </p>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs p-3 rounded mb-4">
          {error}
        </div>
      )}

      {savedSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs p-3 rounded mb-4 font-semibold">
          ✓ Details updated successfully!
        </div>
      )}

      {/* Form to update subject and comment */}
      <form onSubmit={handleSaveDetails} className="space-y-4 bg-white p-4 rounded border border-indigo-200 mb-4">
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Subject Line
          </label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            required
            className="w-full text-xs p-2 border border-slate-300 rounded focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Applicant Note / Reason
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            className="w-full text-xs p-2 border border-slate-300 rounded focus:ring-1 focus:ring-indigo-500"
            placeholder="Clarify or correct your original reason..."
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded transition disabled:opacity-50"
        >
          {saving ? "Saving Changes..." : "Save Subject & Remarks"}
        </button>
      </form>

      {/* Attachments Editor */}
      <div className="bg-white p-4 rounded border border-indigo-200 mb-4 space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-slate-700">
            Attached Documents ({attachments.length}/10)
          </label>
          {attachments.length < 10 && (
            <label className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer border border-indigo-200 px-2 py-1 rounded hover:bg-indigo-50 transition">
              + Upload File
              <input
                type="file"
                className="hidden"
                accept=".pdf,.png,.jpg,.jpeg,.docx"
                onChange={handleAddAttachment}
              />
            </label>
          )}
        </div>

        <ul className="divide-y divide-slate-100 text-xs">
          {attachments.map((a) => (
            <li key={a.id} className="py-1.5 flex items-center justify-between">
              <span className="truncate text-slate-700">{a.original_name}</span>
              <button
                type="button"
                onClick={() => handleRemoveAttachment(a.id)}
                className="text-rose-600 hover:text-rose-800 font-semibold ml-2"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Final Resubmit Button */}
      <div className="pt-2 flex justify-end">
        <button
          type="button"
          onClick={handleResubmit}
          disabled={resubmitting}
          className="bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-sm font-bold px-6 py-2.5 rounded shadow transition"
        >
          {resubmitting ? "Resubmitting..." : "✓ Resubmit Application for Review"}
        </button>
      </div>
    </div>
  );
}

export function WithdrawOnlyAction({ applicationId }: { applicationId: string }) {
  const router = useRouter();
  const [withdrawing, setWithdrawing] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleWithdraw = async () => {
    setWithdrawing(true);
    setError(null);
    try {
      const res = await fetch(`/api/applications/${applicationId}/withdraw`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() || null }),
      });
      const data = await res.json();
      if (res.ok) {
        router.refresh();
      } else {
        setError(data.error || "Failed to withdraw");
        setWithdrawing(false);
      }
    } catch {
      setError("Network error");
      setWithdrawing(false);
    }
  };

  if (!showConfirm) {
    return (
      <button
        type="button"
        onClick={() => setShowConfirm(true)}
        className="text-xs text-rose-600 hover:text-rose-800 font-semibold border border-rose-200 hover:bg-rose-50 px-3 py-1.5 rounded transition cursor-pointer"
      >
        Cancel / Withdraw Application
      </button>
    );
  }

  return (
    <div className="bg-rose-50 border border-rose-300 rounded-lg p-4 max-w-lg space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold text-rose-900 uppercase tracking-wide">
          ⚠️ Confirm Application Withdrawal
        </h4>
        <button
          type="button"
          onClick={() => {
            setShowConfirm(false);
            setError(null);
          }}
          className="text-slate-400 hover:text-slate-600 text-xs font-bold"
        >
          ✕ Close
        </button>
      </div>

      <p className="text-xs text-rose-800">
        Are you sure you want to withdraw this application? This action will cancel the application and remove it from reviewer queues.
      </p>

      <div>
        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
          Reason for withdrawal (Optional):
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Schedule changed, no longer required..."
          rows={2}
          className="w-full text-xs p-2 border border-slate-300 rounded focus:ring-1 focus:ring-rose-500 bg-white"
        />
      </div>

      {error && (
        <div className="bg-rose-100 border border-rose-300 text-rose-900 text-xs p-2 rounded font-medium">
          {error}
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={handleWithdraw}
          disabled={withdrawing}
          className="bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold px-3.5 py-1.5 rounded transition shadow-xs cursor-pointer"
        >
          {withdrawing ? "Withdrawing..." : "Yes, Withdraw Application"}
        </button>
        <button
          type="button"
          onClick={() => {
            setShowConfirm(false);
            setError(null);
          }}
          disabled={withdrawing}
          className="bg-white hover:bg-slate-100 text-slate-700 text-xs font-medium px-3 py-1.5 border border-slate-300 rounded transition cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
