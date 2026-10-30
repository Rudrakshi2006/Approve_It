"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Session } from "@/lib/session";
import { formatToDDMMYYYY } from "@/lib/date";
import {
  FileUploadDropzone,
  type UploadedAttachment,
} from "@/components/FileUploadDropzone";

interface FacultyOption {
  login_id: string;
  name: string;
  department: string;
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
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [classTeacher, setClassTeacher] = useState("");
  const [comment, setComment] = useState("");
  const [attachments, setAttachments] = useState<UploadedAttachment[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Medical leave is strictly for past illness missed (no current/future dates allowed)
  const todayIST = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
  }).format(new Date());
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const maxPastDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
  }).format(yesterday);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!subject.trim()) {
      setError("Please provide a subject");
      return;
    }

    if (!fromDate || !toDate) {
      setError("Both Leave From Date and To Date are compulsory");
      return;
    }

    if (fromDate >= todayIST || toDate >= todayIST) {
      setError(
        "Medical leave applies strictly to past dates missed due to illness (today and future dates are not allowed)"
      );
      return;
    }

    if (toDate < fromDate) {
      setError("Leave To Date cannot be earlier than From Date");
      return;
    }

    if (!classTeacher) {
      setError("Please select your Class Teacher");
      return;
    }

    setSubmitting(true);

    const fromDateFormatted = formatToDDMMYYYY(fromDate);
    const toDateFormatted = formatToDDMMYYYY(toDate);
    const finalSubject = subject.includes(fromDateFormatted)
      ? subject.trim()
      : `${subject.trim()} (${fromDateFormatted} to ${toDateFormatted})`;

    try {
      const res = await fetch("/api/applications/medical", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: finalSubject,
          class_teacher_login_id: classTeacher,
          comment: comment.trim() || null,
          urgent: false,
          payload: {
            from_date: fromDate,
            to_date: toDate,
          },
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
          placeholder="e.g. Severe Viral Fever and Medical Leave"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-md text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
        />
      </div>

      {/* Leave Period Dates (Strictly Past Dates) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-slate-900 mb-1">
            Leave From Date <span className="text-rose-500">*</span>
          </label>
          <input
            type="date"
            required
            max={maxPastDate}
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-md text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
          <p className="text-[11px] text-slate-500 mt-1">
            Must be a past date missed due to illness (max: yesterday)
          </p>
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-900 mb-1">
            Leave To Date <span className="text-rose-500">*</span>
          </label>
          <input
            type="date"
            required
            min={fromDate || undefined}
            max={maxPastDate}
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-md text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
          <p className="text-[11px] text-slate-500 mt-1">
            Must be a past date (cannot be today or future)
          </p>
        </div>
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
          {submitting ? "Submitting Application..." : "Submit Medical Application"}
        </button>
      </div>
    </form>
  );
}
