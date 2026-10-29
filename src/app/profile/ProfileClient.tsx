"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Session } from "@/lib/session";

export function ProfileClient({
  session,
  currentSemester,
  suggestedSemester,
  currentSignatureUrl,
}: {
  session: Session;
  currentSemester: number | null;
  suggestedSemester: number;
  currentSignatureUrl: string | null;
}) {
  const router = useRouter();
  const [semester, setSemester] = useState<number>(currentSemester || suggestedSemester);
  const [savingSem, setSavingSem] = useState(false);
  const [semMsg, setSemMsg] = useState<string | null>(null);

  const [sigUrl, setSigUrl] = useState<string | null>(currentSignatureUrl);
  const [uploadingSig, setUploadingSig] = useState(false);
  const [sigMsg, setSigMsg] = useState<string | null>(null);

  const isStudent = session.eklink_role === "student";

  // Handle Semester Update
  const handleSaveSemester = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSem(true);
    setSemMsg(null);

    try {
      const res = await fetch("/api/profile/semester", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ semester }),
      });
      const data = await res.json();
      if (res.ok) {
        setSemMsg("Semester updated successfully!");
        router.refresh();
      } else {
        setSemMsg(data.error || "Failed to update semester");
      }
    } catch {
      setSemMsg("Error updating semester");
    } finally {
      setSavingSem(false);
    }
  };

  // Handle Signature Upload
  const handleSignatureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    setUploadingSig(true);
    setSigMsg(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/profile/signature", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (res.ok) {
        setSigMsg("Digital signature uploaded successfully!");
        setSigUrl(URL.createObjectURL(file));
        router.refresh();
      } else {
        setSigMsg(data.error || "Failed to upload signature");
      }
    } catch {
      setSigMsg("Error uploading signature");
    } finally {
      setUploadingSig(false);
      e.target.value = "";
    }
  };

  // Handle Signature Removal
  const handleRemoveSignature = async () => {
    if (!confirm("Are you sure you want to remove your digital signature?")) return;
    setUploadingSig(true);
    setSigMsg(null);

    try {
      const res = await fetch("/api/profile/signature", { method: "DELETE" });
      if (res.ok) {
        setSigUrl(null);
        setSigMsg("Signature removed from current profile.");
        router.refresh();
      } else {
        setSigMsg("Failed to remove signature");
      }
    } catch {
      setSigMsg("Error removing signature");
    } finally {
      setUploadingSig(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Identity Card */}
      <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">
          Profile Information (From EkLink)
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <span className="text-slate-400 block">Full Name</span>
            <span className="font-bold text-slate-900 text-sm">{session.name}</span>
          </div>
          <div>
            <span className="text-slate-400 block">PRN / Staff ID</span>
            <span className="font-mono text-slate-900 text-sm">{session.login_id}</span>
          </div>
          <div>
            <span className="text-slate-400 block">Email Address</span>
            <span className="text-slate-800">{session.email}</span>
          </div>
          <div>
            <span className="text-slate-400 block">System Role</span>
            <span className="capitalize font-semibold text-slate-900">
              {session.eklink_role}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block">Department</span>
            <span className="text-slate-800 font-medium">
              {session.department || "CSE"}
            </span>
          </div>
          {isStudent && (
            <div>
              <span className="text-slate-400 block">Batch &amp; Section</span>
              <span className="text-slate-800">
                {session.batch || "2024-28"} (Sec {session.section || "A"})
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Student: Semester Confirmation */}
      {isStudent && (
        <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
            Academic Semester Confirmation
          </h3>
          <p className="text-xs text-slate-500 mb-4">
            Suggested automatically from your batch ({session.batch || "2024-28"}):{" "}
            <span className="font-semibold text-slate-800">
              Semester {suggestedSemester}
            </span>
            . Confirm or update if you are in a different semester.
          </p>

          {semMsg && (
            <div className="bg-slate-50 border border-slate-200 text-slate-800 text-xs p-3 rounded mb-4">
              {semMsg}
            </div>
          )}

          <form onSubmit={handleSaveSemester} className="flex items-center gap-3">
            <select
              value={semester}
              onChange={(e) => setSemester(parseInt(e.target.value, 10))}
              className="bg-white border border-slate-300 rounded px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                <option key={s} value={s}>
                  Semester {s}
                </option>
              ))}
            </select>

            <button
              type="submit"
              disabled={savingSem}
              className="bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-semibold px-4 py-2 rounded transition"
            >
              {savingSem ? "Saving..." : "Save Semester"}
            </button>
          </form>
        </div>
      )}

      {/* Approver: Digital Signature Upload */}
      {!isStudent && (
        <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
            Approver Digital Signature (Optional)
          </h3>
          <p className="text-xs text-slate-500 mb-4">
            Upload an image of your signature. When you approve or verify applications, this signature will be included inside your official Digital Verification Stamp.
          </p>

          {sigMsg && (
            <div className="bg-slate-50 border border-slate-200 text-slate-800 text-xs p-3 rounded mb-4">
              {sigMsg}
            </div>
          )}

          {sigUrl ? (
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg inline-block">
                <span className="text-[10px] text-slate-400 block mb-1 uppercase font-bold tracking-wider">
                  Current Signature
                </span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={sigUrl}
                  alt="Current Signature"
                  className="max-h-20 max-w-xs object-contain border border-slate-200 rounded p-1 bg-white"
                />
              </div>

              <div className="flex items-center gap-3">
                <label className="cursor-pointer bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold px-3 py-2 rounded transition">
                  {uploadingSig ? "Uploading..." : "Replace Signature"}
                  <input
                    type="file"
                    accept=".png,.jpg,.jpeg"
                    disabled={uploadingSig}
                    onChange={handleSignatureUpload}
                    className="hidden"
                  />
                </label>

                <button
                  type="button"
                  onClick={handleRemoveSignature}
                  disabled={uploadingSig}
                  className="text-rose-600 hover:text-rose-800 text-xs font-semibold px-2 py-1"
                >
                  Remove Signature
                </button>
              </div>
            </div>
          ) : (
            <div>
              <label className="cursor-pointer inline-block bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold px-4 py-2.5 rounded shadow-sm transition">
                {uploadingSig ? "Uploading..." : "+ Upload Digital Signature (PNG/JPG, max 1 MB)"}
                <input
                  type="file"
                  accept=".png,.jpg,.jpeg"
                  disabled={uploadingSig}
                  onChange={handleSignatureUpload}
                  className="hidden"
                />
              </label>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
