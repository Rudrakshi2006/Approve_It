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
      setError("Please provide a subject");
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
          urgent: false,
          attachments,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to submit medical application");
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
        <div className="bg-rose-50 border border-rose-200 text-rose-800 text-sm p-4 rounded-md">
          {error}
        </div>
      )}

      {/* Frozen Snapshot Card */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Applicant Identity Snapshot (Auto-frozen)
          </h3>
          <Link href="/profile" className="text-xs text-indigo-600 hover:underline">
            Edit in Profile
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div>
            <span className="text-slate-400 block">Student Name</span>
            <span className="font-semibold text-slate-900">{session.name}</span>
          </div>
          <div>
            <span className="text-slate-400 block">PRN / Roll No</span>
            <span className="font-mono text-slate-800">{session.login_id}</span>
          </div>
          <div>
            <span className="text-slate-400 block">Department &amp; Batch</span>
            <span className="text-slate-800">
              {session.department || "CSE"} • {session.batch || "2024-28"}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block">Semester &amp; Section</span>
            <span className="text-slate-800">
              Semester {suggestedSemester} (Sec {session.section || "A"})
            </span>
          </div>
        </div>
      </div>

      {/* Subject */}
      <div>
        <label className="block text-sm font-semibold text-slate-900 mb-1">
          Subject / Medical Reason <span className="text-rose-500">*</span>
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

      {/* Attachments Section */}
      <div className="border border-slate-200 rounded-lg p-5 bg-white">
        <label className="block text-sm font-semibold text-slate-900 mb-1">
          Medical Certificates &amp; Prescriptions
        </label>
        <p className="text-xs text-slate-500 mb-3">
          Upload official doctor prescription, medical certificate, or hospital discharge slip. Max 10 files (PDF, JPG, PNG up to 5 MB each).
        </p>

        <input
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png,image/png,image/jpeg,application/pdf"
          disabled={uploading || attachments.length >= 10}
          onChange={handleFileUpload}
          className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-slate-900 file:text-white hover:file:bg-slate-800 cursor-pointer disabled:opacity-50"
        />

        {uploading && (
          <p className="text-xs text-indigo-600 font-medium mt-2">
            Uploading and verifying attachments...
          </p>
        )}

        {attachments.length > 0 && (
          <div className="mt-4 space-y-2">
            <span className="text-xs font-semibold text-slate-700 block">
              Attached Files ({attachments.length} of 10):
            </span>
            <ul className="divide-y divide-slate-100 border border-slate-200 rounded-md bg-slate-50">
              {attachments.map((file, idx) => (
                <li
                  key={file.storage_path}
                  className="px-3 py-2 flex items-center justify-between text-xs"
                >
                  <span className="truncate max-w-xs font-medium text-slate-800">
                    📄 {file.original_name}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-slate-400">
                      {(file.size_bytes / 1024).toFixed(1)} KB
                    </span>
                    <button
                      type="button"
                      onClick={() => removeAttachment(idx)}
                      className="text-rose-600 hover:text-rose-800 font-bold"
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Submit Action */}
      <div className="pt-2">
        <button
          type="submit"
          disabled={submitting || uploading}
          className="w-full bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold py-3 px-4 rounded-md text-sm transition shadow-sm"
        >
          {submitting ? "Submitting Application..." : "Submit Medical Application"}
        </button>
      </div>
    </form>
  );
}
