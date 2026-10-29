"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Session } from "@/lib/session";

interface FacultyOption {
  login_id: string;
  name: string;
  department: string;
}

interface UploadedFile {
  storage_path: string;
  original_name: string;
  size_bytes: number;
  mime: string;
}

export function MedicalForm({
  session,
  facultyList,
  suggestedSemester,
}: {
  session: Session;
  facultyList: FacultyOption[];
  suggestedSemester: number;
}) {
  const router = useRouter();
  const [subject, setSubject] = useState("");
  const [classTeacher, setClassTeacher] = useState("");
  const [comment, setComment] = useState("");
  const [urgent, setUrgent] = useState(false);
  const [attachments, setAttachments] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setError(null);

    const files = Array.from(e.target.files);
    if (attachments.length + files.length > 10) {
      setError("Maximum 10 files allowed in total");
      return;
    }

    setUploading(true);

    for (const file of files) {
      if (file.size > 5 * 1024 * 1024) {
        setError(`File ${file.name} exceeds 5 MB limit`);
        setUploading(false);
        return;
      }

      const formData = new FormData();
      formData.append("file", file);

      try {
        const res = await fetch("/api/attachments/upload", {
          method: "POST",
          body: formData,
        });

        const data = await res.json();
        if (!res.ok) {
          setError(data.error || `Upload failed for ${file.name}`);
          setUploading(false);
          return;
        }

        setAttachments((prev) => [
          ...prev,
          {
            storage_path: data.storage_path,
            original_name: data.original_name,
            size_bytes: data.size_bytes,
            mime: data.mime,
          },
        ]);
      } catch {
        setError(`Failed to upload ${file.name}`);
        setUploading(false);
        return;
      }
    }

    setUploading(false);
    e.target.value = "";
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!subject.trim()) {
      setError("Please enter a subject");
      return;
    }

    if (!classTeacher) {
      setError("Please select your Class Teacher");
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch("/api/applications/medical", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: subject.trim(),
          class_teacher_login_id: classTeacher,
          comment: comment.trim() || null,
          urgent,
          attachments,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to submit application");
        setSubmitting(false);
        return;
      }

      router.push(`/applications/${data.id}`);
    } catch {
      setError("An unexpected network error occurred");
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 text-sm p-4 rounded-md">
          {error}
        </div>
      )}

      {/* Read-only Student Details Card */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-5">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
          Applicant Information (Auto-filled from EkLink)
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
          <div>
            <span className="block text-xs text-slate-500">Student Name</span>
            <span className="font-semibold text-slate-900">{session.name}</span>
          </div>
          <div>
            <span className="block text-xs text-slate-500">PRN / Login ID</span>
            <span className="font-mono text-slate-900">{session.login_id}</span>
          </div>
          <div>
            <span className="block text-xs text-slate-500">Department</span>
            <span className="font-medium text-slate-900">{session.department || "CSE"}</span>
          </div>
          <div>
            <span className="block text-xs text-slate-500">Batch</span>
            <span className="text-slate-900">{session.batch || "2024-28"}</span>
          </div>
          <div>
            <span className="block text-xs text-slate-500">Semester</span>
            <span className="text-slate-900">Semester {suggestedSemester}</span>
          </div>
          <div>
            <span className="block text-xs text-slate-500">Section</span>
            <span className="text-slate-900">{session.section || "A"}</span>
          </div>
        </div>
      </div>

      {/* Subject */}
      <div>
        <label className="block text-sm font-semibold text-slate-900 mb-1">
          Subject / Reason for Medical Leave <span className="text-rose-500">*</span>
        </label>
        <input
          type="text"
          required
          placeholder="e.g. Severe Viral Fever and Medical Leave from 25 Oct to 28 Oct"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-md text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
        />
      </div>

      {/* Class Teacher Dropdown */}
      <div>
        <label className="block text-sm font-semibold text-slate-900 mb-1">
          Select Class Teacher <span className="text-rose-500">*</span>
        </label>
        <select
          required
          value={classTeacher}
          onChange={(e) => setClassTeacher(e.target.value)}
          className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-md text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
        >
          <option value="">-- Choose your Class Teacher --</option>
          {facultyList.map((f) => (
            <option key={f.login_id} value={f.login_id}>
              {f.name} ({f.department || "CSE"})
            </option>
          ))}
        </select>
        <p className="text-xs text-slate-500 mt-1">
          Step 1 verification will be routed directly to this faculty member.
        </p>
      </div>

      {/* Additional Comments */}
      <div>
        <label className="block text-sm font-semibold text-slate-900 mb-1">
          Additional Notes / Comments (Optional)
        </label>
        <textarea
          rows={3}
          placeholder="Provide any doctor recommendations, hospital details or exam clash notes..."
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-md text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
        />
      </div>

      {/* Urgent Toggle */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="urgent"
          checked={urgent}
          onChange={(e) => setUrgent(e.target.checked)}
          className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
        />
        <label htmlFor="urgent" className="text-sm font-medium text-slate-800 cursor-pointer">
          Mark as Urgent (e.g. exams scheduled within 24-48 hours)
        </label>
      </div>

      {/* Attachments Section */}
      <div className="border-t border-slate-200 pt-5">
        <label className="block text-sm font-semibold text-slate-900 mb-1">
          Medical Documents & Doctor&apos;s Prescription
        </label>
        <p className="text-xs text-slate-500 mb-3">
          Upload up to 10 files. Allowed formats: PDF, JPG, PNG (Max 5 MB each).
        </p>

        <div className="flex items-center gap-3 mb-3">
          <label className="cursor-pointer bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold px-4 py-2 rounded-md transition shadow-sm">
            {uploading ? "Uploading..." : "+ Attach Document"}
            <input
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png"
              disabled={uploading || attachments.length >= 10}
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
          <span className="text-xs text-slate-500 font-medium">
            {attachments.length} / 10 files attached
          </span>
        </div>

        {/* Uploaded Files List */}
        {attachments.length > 0 && (
          <ul className="divide-y divide-slate-100 bg-white border border-slate-200 rounded-md">
            {attachments.map((file, idx) => (
              <li key={idx} className="flex items-center justify-between px-3.5 py-2.5 text-xs">
                <div className="flex items-center gap-2 overflow-hidden">
                  <span className="font-mono text-[10px] uppercase bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">
                    {file.mime.includes("pdf") ? "PDF" : "IMG"}
                  </span>
                  <span className="truncate text-slate-800 font-medium">
                    {file.original_name}
                  </span>
                  <span className="text-slate-400">
                    ({Math.round(file.size_bytes / 1024)} KB)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => removeAttachment(idx)}
                  className="text-rose-600 hover:text-rose-800 font-semibold ml-2"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Submit / Cancel Buttons */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
        <Link
          href="/"
          className="text-sm font-medium text-slate-600 hover:text-slate-800 px-4 py-2"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={submitting || uploading}
          className="bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-sm font-semibold px-6 py-2.5 rounded-md shadow-sm transition"
        >
          {submitting ? "Submitting Application..." : "Submit Application"}
        </button>
      </div>
    </form>
  );
}
