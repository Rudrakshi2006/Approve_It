"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AttachmentUploader, type UploadedFileItem } from "@/components/AttachmentUploader";

const CATEGORIES = ["MOM", "Report", "Event proposal", "Other"];

export function EmployeeGeneralForm() {
  const router = useRouter();
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [comment, setComment] = useState("");
  const [urgent, setUrgent] = useState(false);
  const [attachments, setAttachments] = useState<UploadedFileItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!subject.trim()) {
      setError("Please enter a subject");
      return;
    }

    if (!description.trim()) {
      setError("Please provide a description");
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch("/api/applications/employee/general", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          subject: subject.trim(),
          description: description.trim(),
          comment: comment.trim() || description.trim(),
          urgent,
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
        setError(data.error || "Failed to submit general application");
        setSubmitting(false);
        return;
      }

      router.push(`/applications/${data.id}`);
      router.refresh();
    } catch {
      setError("An unexpected network error occurred");
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-md text-sm font-medium">
          {error}
        </div>
      )}

      <div>
        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
          Category <span className="text-rose-600 font-bold">*</span>
        </label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-md text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 cursor-pointer shadow-xs"
        >
          {CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
          Subject <span className="text-rose-600 font-bold">*</span>
        </label>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="e.g. Minutes of Departmental Meeting / Event Proposal"
          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 shadow-2xs"
          required
        />
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
          Description &amp; Details <span className="text-rose-600 font-bold">*</span>
        </label>
        <textarea
          rows={5}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Provide detailed information regarding this application..."
          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 shadow-2xs"
          required
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="urgent-check"
          checked={urgent}
          onChange={(e) => setUrgent(e.target.checked)}
          className="w-4 h-4 text-slate-900 rounded border-slate-300 focus:ring-slate-900 cursor-pointer"
        />
        <label htmlFor="urgent-check" className="text-xs text-slate-700 font-semibold cursor-pointer">
          Mark as Urgent (requires priority review)
        </label>
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
          Supporting Documents &amp; Proofs (Optional)
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
          disabled={submitting}
          className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-md text-sm font-semibold shadow-sm transition cursor-pointer"
        >
          {submitting ? "Submitting..." : "Submit General Application"}
        </button>
      </div>
    </form>
  );
}
