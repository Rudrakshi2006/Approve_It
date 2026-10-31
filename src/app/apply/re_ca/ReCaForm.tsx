"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Session } from "@/lib/session";
import { formatToDDMMYYYY } from "@/lib/date";

interface FacultyOption {
  login_id: string;
  name: string;
  department: string;
}

import {
  FileUploadDropzone,
  type UploadedAttachment,
} from "@/components/FileUploadDropzone";

export function ReCaForm({
  session,
  facultyList,
  suggestedSemester,
}: {
  session: Session;
  facultyList: FacultyOption[];
  suggestedSemester: number;
}) {
  const router = useRouter();
  const [courseName, setCourseName] = useState("");
  const [facultyId, setFacultyId] = useState("");
  const [caDate, setCaDate] = useState("");
  const [caType, setCaType] = useState("CA 1");
  const [reasonCategory, setReasonCategory] = useState("Medical Emergency");
  const [comment, setComment] = useState("");
  const [urgent, setUrgent] = useState(false);
  const [attachments, setAttachments] = useState<UploadedAttachment[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!courseName.trim()) {
      setError("Please provide the Subject / Course Name");
      return;
    }

    if (!facultyId) {
      setError("Please select the Course Faculty");
      return;
    }

    if (!caDate) {
      setError("Please select the original CA Date that was missed");
      return;
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    if (caDate >= todayStr) {
      setError("Re-CA applies only for exams/tests missed in the past (current and future dates are not permitted)");
      return;
    }

    if (attachments.length === 0) {
      setError("Supporting proof document (medical certificate, duty leave slip, or valid evidence) is compulsory. Please upload at least one attachment.");
      return;
    }

    setSubmitting(true);

    const caDateFormatted = formatToDDMMYYYY(caDate);
    const subject = `Re-Continuous Assessment (${caType}): ${courseName.trim()} (Missed on ${caDateFormatted})`;
    const payload = {
      course_name: courseName.trim(),
      ca_type: caType,
      ca_date: caDate,
      reason_category: reasonCategory,
      comment: comment.trim() || null,
    };

    try {
      const res = await fetch("/api/applications/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "re_ca",
          subject,
          class_teacher_login_id: facultyId,
          payload,
          comment: comment.trim() || null,
          urgent,
          attachments,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to submit Re-CA application");
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

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const maxPastDate = yesterday.toISOString().slice(0, 10);

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

      {/* Course & CA Details */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-slate-900 mb-1">
            Course / Subject Name <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            required
            placeholder="e.g. Data Structures & Algorithms (CS201)"
            value={courseName}
            onChange={(e) => setCourseName(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-md text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-900 mb-1">
            Course Faculty <span className="text-rose-500">*</span>
          </label>
          <select
            required
            value={facultyId}
            onChange={(e) => setFacultyId(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-md text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
          >
            <option value="">-- Choose Course Faculty --</option>
            {facultyList.map((f) => (
              <option key={f.login_id} value={f.login_id}>
                {f.name} ({f.department || "CSE"})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-900 mb-1">
            Assessment Type <span className="text-rose-500">*</span>
          </label>
          <select
            value={caType}
            onChange={(e) => setCaType(e.target.value)}
            className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-md text-sm text-slate-900"
          >
            <option value="CA 1">Continuous Assessment 1 (CA 1)</option>
            <option value="CA 2">Continuous Assessment 2 (CA 2)</option>
            <option value="CA 3 / Lab Test">CA 3 / Practical Lab Exam</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-900 mb-1">
            Missed Exam Date <span className="text-rose-500">*</span>
          </label>
          <input
            type="date"
            required
            max={maxPastDate}
            value={caDate}
            onChange={(e) => setCaDate(e.target.value)}
            className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-md text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-900 mb-1">
          Reason Category <span className="text-rose-500">*</span>
        </label>
        <select
          value={reasonCategory}
          onChange={(e) => setReasonCategory(e.target.value)}
          className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-md text-sm text-slate-900"
        >
          <option value="Medical Emergency">Medical Illness / Hospitalization</option>
          <option value="Official College Representation">Official College Representation (Sports / Hackathon / Cultural)</option>
          <option value="Bereavement / Family Emergency">Family Emergency / Bereavement</option>
          <option value="Other Genuine Ground">Other Genuine Reason</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-900 mb-1">
          Detailed Explanation / Justification
        </label>
        <textarea
          rows={3}
          placeholder="State the circumstances why you were unable to appear for the test..."
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-md text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
        />
      </div>

      {/* Urgent Checkbox (Permitted on Re-CA) */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
        <label className="flex items-center gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            id="urgent"
            checked={urgent}
            onChange={(e) => setUrgent(e.target.checked)}
            className="w-4 h-4 text-rose-600 rounded border-slate-300 focus:ring-rose-500 cursor-pointer"
          />
          <div>
            <span className="text-xs font-bold text-amber-950 block">
              ⚡ Mark as Urgent Application
            </span>
            <span className="text-[11px] text-amber-800">
              Only check if the re-examination schedule deadline is within 24–48 hours.
            </span>
          </div>
        </label>
      </div>

      {/* Attachments Section */}
      <div className="border border-slate-200 rounded-lg p-5 bg-white">
        <label className="block text-sm font-semibold text-slate-900 mb-1">
          Supporting Documents &amp; Evidence * (Compulsory)
        </label>
        <p className="text-xs text-slate-500 mb-3">
          Upload medical certificate, duty leave letter, or supporting proof. Max 10 files (PDF, JPG, PNG up to 5 MB each).
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
          {submitting ? "Submitting Application..." : "Submit Re-CA Application"}
        </button>
      </div>
    </form>
  );
}
