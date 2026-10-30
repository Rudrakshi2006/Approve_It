"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface SampleRow {
  login_id: string;
  name: string;
  college_email: string;
  role: string;
  department?: string | null;
}

export function PeopleClient() {
  const router = useRouter();
  const [csvContent, setCsvContent] = useState("");
  const [parsing, setParsing] = useState(false);
  const [previewData, setPreviewData] = useState<{ total_count: number; sample: SampleRow[] } | null>(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setSuccess(null);
    setPreviewData(null);

    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvContent(text || "");
    };
    reader.readAsText(file);
  };

  const handlePreview = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setPreviewData(null);

    if (!csvContent.trim()) {
      setError("Please paste CSV data or select a .csv file");
      return;
    }

    setParsing(true);

    try {
      const res = await fetch("/api/admin/people/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: csvContent, confirm: false }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to validate CSV");
        setParsing(false);
        return;
      }

      setPreviewData(data);
    } catch {
      setError("Network error validating CSV");
    } finally {
      setParsing(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!previewData) return;
    setError(null);
    setImporting(true);

    try {
      const res = await fetch("/api/admin/people/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: csvContent, confirm: true }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to import people records");
        setImporting(false);
        return;
      }

      setSuccess(`Successfully imported / updated ${data.imported_count} people records! (eklink_sub, semester, and signature_path preserved)`);
      setPreviewData(null);
      setCsvContent("");
      router.refresh();
    } catch {
      setError("Network error executing import");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 text-sm p-4 rounded-lg font-medium">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm p-4 rounded-lg font-medium">
          ✓ {success}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
        <h2 className="text-base font-bold text-slate-900 mb-1">
          Import Faculty, Staff &amp; Students via CSV
        </h2>
        <p className="text-xs text-slate-500 mb-4">
          Upload a comma-separated file. Columns must be: <code className="font-mono bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded">login_id,name,college_email,role,department</code>.
          Existing users will be safely upserted without overwriting their confirmed semesters or signature images.
        </p>

        <form onSubmit={handlePreview} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Select CSV File
            </label>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileUpload}
              className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-slate-900 file:text-white hover:file:bg-slate-800 cursor-pointer"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Or Paste CSV Text Directly
            </label>
            <textarea
              rows={6}
              value={csvContent}
              onChange={(e) => setCsvContent(e.target.value)}
              placeholder="login_id,name,college_email,role,department&#10;T099,Dr. Sample Faculty,sample@sitnagpur.siu.edu.in,faculty,CSE&#10;24070529999,Student Name,student@sitnagpur.siu.edu.in,student,CSE"
              className="w-full font-mono text-xs px-3 py-2 bg-slate-50 border border-slate-300 rounded text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white"
            />
          </div>

          <button
            type="submit"
            disabled={parsing || !csvContent.trim()}
            className="bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-bold px-4 py-2.5 rounded shadow-sm transition"
          >
            {parsing ? "Validating CSV..." : "Validate & Preview CSV"}
          </button>
        </form>
      </div>

      {/* Preview Section */}
      {previewData && (
        <div className="bg-white border-2 border-indigo-600 rounded-lg p-6 shadow-md">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                CSV Validation Passed ({previewData.total_count} records ready)
              </h3>
              <p className="text-xs text-slate-500">
                Below is a sample preview of the first {previewData.sample.length} records. Review before committing to database.
              </p>
            </div>
            <button
              onClick={handleConfirmImport}
              disabled={importing}
              className="bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-bold px-5 py-2.5 rounded shadow-sm transition"
            >
              {importing ? "Importing to Database..." : `✓ Confirm & Import ${previewData.total_count} Records`}
            </button>
          </div>

          <div className="border border-slate-200 rounded overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold uppercase">
                <tr>
                  <th className="px-4 py-2">Login ID</th>
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2">College Email</th>
                  <th className="px-4 py-2">Role</th>
                  <th className="px-4 py-2">Department</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                {previewData.sample.map((row) => (
                  <tr key={row.login_id} className="hover:bg-slate-50">
                    <td className="px-4 py-2 font-bold text-slate-900">{row.login_id}</td>
                    <td className="px-4 py-2 font-sans font-medium text-slate-800">{row.name}</td>
                    <td className="px-4 py-2 text-slate-600">{row.college_email}</td>
                    <td className="px-4 py-2 capitalize font-sans">{row.role}</td>
                    <td className="px-4 py-2 font-sans">{row.department || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
