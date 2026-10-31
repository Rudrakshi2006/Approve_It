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

import {
  FileUploadDropzone,
  type UploadedAttachment,
} from "@/components/FileUploadDropzone";

export function GeneralForm({
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
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [classTeacher, setClassTeacher] = useState("");
  const [category, setCategory] = useState("Bonafide / Recommendation Request");
  const [comment, setComment] = useState("");
  const [attachments, setAttachments] = useState<UploadedAttachment[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!subject.trim()) {
      setError("Please provide a subject");
      return;
    }

    if (!fromDate) {
      setError("Please select From Date");
      return;
    }

    const effectiveToDate = toDate.trim() || fromDate.trim();
    if (effectiveToDate < fromDate) {
      setError("To Date cannot be earlier than From Date");
      return;
    }

    if (!classTeacher) {
      setError("Please select the recipient Faculty Member / Mentor");
      return;
    }

    setSubmitting(true);

    const payload = {
      category,
      from_date: fromDate,
      to_date: effectiveToDate,
      comment: comment.trim() || null,
    };

    try {
      const res = await fetch("/api/applications/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "general",
          subject: subject.trim(),
          class_teacher_login_id: classTeacher,
          payload,
          comment: comment.trim() || null,
          urgent: false,
          attachments,
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

      <div>
        <label className="block text-sm font-semibold text-slate-900 mb-1">
          Application Category
        </label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-md text-sm text-slate-900"
        >
          <option value="Bonafide / Recommendation Request">Bonafide / LOR / Character Certificate Request</option>
          <option value="ID Card / Gate Pass Reissue">ID Card / Campus Gate Pass Reissue</option>
          <option value="Club / Event Campus Permission">Student Club / Event Campus Permission</option>
          <option value="Course / Lab Transfer Request">Course / Lab Section Transfer Request</option>
          <option value="Other Official Request">Other Official Purpose</option>
        </select>
      </div>

      {/* Subject */}
      <div>
        <label className="block text-sm font-semibold text-slate-900 mb-1">
          Subject / Title <span className="text-red-600 font-bold ml-1">*</span>
        </label>
        <input
          type="text"
          required
          placeholder="e.g. Request for Bonafide Certificate for Passport Verification"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-md text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
        />
      </div>

      {/* Date Range (All Dates Allowed) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-slate-900 mb-1">
            From Date <span className="text-red-600 font-bold ml-1">*</span>
          </label>
          <input
            type="date"
            required
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-md text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 cursor-pointer"
          />
          <p className="text-[11px] text-slate-500 mt-1">
            All dates (past, current, and future) are permitted
          </p>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm font-semibold text-slate-900">
              To Date
            </label>
            <span className="text-[11px] text-slate-400 font-normal">
              (Optional — leave blank for 1 day)
            </span>
          </div>
          <input
            type="date"
            min={fromDate || undefined}
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-md text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 cursor-pointer"
          />
          <p className="text-[11px] text-slate-500 mt-1">
            All dates permitted (leave blank for single day)
          </p>
        </div>
      </div>

      {/* Faculty Recipient */}
      <div>
        <label className="block text-sm font-semibold text-slate-900 mb-1">
          Select Faculty Recipient / Mentor <span className="text-red-600 font-bold ml-1">*</span>
        </label>
        <select
          required
          value={classTeacher}
          onChange={(e) => setClassTeacher(e.target.value)}
          className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-md text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
        >
          <option value="">-- Choose Faculty Recipient --</option>
          {facultyList.map((f) => (
            <option key={f.login_id} value={f.login_id}>
              {f.name} ({f.department || "CSE"})
            </option>
          ))}
        </select>
        <p className="text-xs text-slate-500 mt-1">
          Step 1 verification will be routed directly to this faculty member, followed by HOD.
        </p>
      </div>

      {/* Detailed Description */}
      <div>
        <label className="block text-sm font-semibold text-slate-900 mb-1">
          Detailed Application Letter / Reason <span className="text-red-600 font-bold ml-1">*</span>
        </label>
        <textarea
          rows={4}
          required
          placeholder="State your formal request clearly with all relevant details..."
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-md text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
        />
      </div>

      {/* Attachments Section */}
      <div className="border border-slate-200 rounded-lg p-5 bg-white">
        <label className="block text-sm font-semibold text-slate-900 mb-1">
          Supporting Documents (Optional)
        </label>
        <p className="text-xs text-slate-500 mb-3">
          Upload any letters, receipts, or proofs. Max 10 files (PDF, JPG, PNG up to 5 MB each).
        </p>
        <FileUploadDropzone
          attachments={attachments}
          onAttachmentsChange={setAttachments}
        />
      </div>

      {/* Submit Action */}
      <div className="pt-2">
        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold py-3 px-4 rounded-md text-sm transition shadow-sm"
        >
          {submitting ? "Submitting Application..." : "Submit General Application"}
        </button>
      </div>
    </form>
  );
}
