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
  const [resubmitting, setResubmitting] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Edit details
  const handleSaveDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

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
        alert("Details updated successfully!");
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
    if (!confirm("Are you sure you want to remove this document?")) return;
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
    if (!confirm("Ready to resubmit this application for verification?")) return;
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
    const reason = prompt("Optional: Provide reason for withdrawing this application:");
    if (reason === null) return; // User cancelled prompt

    setWithdrawing(true);
    setError(null);

    try {
      const res = await fetch(`/api/applications/${applicationId}/withdraw`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
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
          onClick={handleWithdraw}
          disabled={withdrawing}
          className="text-xs text-rose-600 hover:text-rose-800 font-semibold underline"
        >
          {withdrawing ? "Cancelling..." : "Withdraw Application"}
        </button>
      </div>

      <p className="text-xs text-indigo-900 mb-4">
        Your reviewer returned this application. You can edit the subject/remarks, attach requested documents, remove incorrect files, and resubmit.
      </p>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs p-3 rounded mb-4">
          {error}
        </div>
      )}

      {/* Edit Form */}
      <form onSubmit={handleSaveDetails} className="space-y-3 mb-5">
        <div>
          <label className="block text-xs font-semibold text-indigo-950 mb-1">
            Subject
          </label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-indigo-200 rounded text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-indigo-950 mb-1">
            Student Notes / Clarification
          </label>
          <textarea
            rows={2}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-indigo-200 rounded text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="bg-indigo-900 hover:bg-indigo-800 text-white text-xs font-semibold px-3 py-1.5 rounded transition"
        >
          {saving ? "Saving Changes..." : "Save Edits"}
        </button>
      </form>

      {/* Manage Attachments (Soft Remove / Add) */}
      <div className="border-t border-indigo-200 pt-4 mb-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-indigo-950">
            Manage Attached Documents ({attachments.length}/10)
          </span>
          {attachments.length < 10 && (
            <label className="cursor-pointer text-xs font-bold text-indigo-700 bg-white border border-indigo-300 hover:bg-indigo-50 px-2.5 py-1 rounded transition">
              + Attach Additional Document
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleAddAttachment}
                className="hidden"
              />
            </label>
          )}
        </div>

        <ul className="divide-y divide-indigo-100 bg-white rounded border border-indigo-200 text-xs">
          {attachments.map((a) => (
            <li key={a.id} className="flex items-center justify-between p-2">
              <span className="truncate text-slate-800">{a.original_name}</span>
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

  const handleWithdraw = async () => {
    const reason = prompt("Optional: Provide reason for withdrawing this application:");
    if (reason === null) return;

    setWithdrawing(true);
    try {
      const res = await fetch(`/api/applications/${applicationId}/withdraw`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      if (res.ok) {
        router.refresh();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to withdraw");
        setWithdrawing(false);
      }
    } catch {
      alert("Network error");
      setWithdrawing(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleWithdraw}
      disabled={withdrawing}
      className="text-xs text-rose-600 hover:text-rose-800 font-semibold border border-rose-200 hover:bg-rose-50 px-3 py-1.5 rounded transition"
    >
      {withdrawing ? "Cancelling..." : "Cancel / Withdraw Application"}
    </button>
  );
}
