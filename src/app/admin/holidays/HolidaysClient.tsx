"use client";

import { useState } from "react";
import { formatISOtoDDMMYYYY, parseDDMMYYYYtoISO } from "@/lib/dates";

interface HolidayRow {
  date: string; // YYYY-MM-DD
  name: string;
}

export function HolidaysClient({ initialHolidays }: { initialHolidays: HolidayRow[] }) {
  const [holidays, setHolidays] = useState(initialHolidays);
  const [newDate, setNewDate] = useState("");
  const [newName, setNewName] = useState("");
  const [csvText, setCsvText] = useState("");
  const [showCsvBox, setShowCsvBox] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleAddSingle = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!newDate.trim() || !newName.trim()) {
      setError("Please fill both date and holiday name");
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch("/api/admin/holidays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: newDate.trim(),
          name: newName.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to add holiday");
        setSubmitting(false);
        return;
      }

      const iso = /^\d{2}-\d{2}-\d{4}$/.test(newDate) ? parseDDMMYYYYtoISO(newDate) : newDate;
      setSuccess(`Holiday "${newName}" added successfully.`);
      setHolidays((prev) =>
        [...prev.filter((h) => h.date !== iso), { date: iso!, name: newName.trim() }].sort(
          (a, b) => a.date.localeCompare(b.date)
        )
      );

      setNewDate("");
      setNewName("");
    } catch {
      setError("An unexpected network error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCsvImport = async () => {
    setError(null);
    setSuccess(null);

    const lines = csvText.trim().split("\n");
    const parsed: Array<{ date: string; name: string }> = [];

    for (const line of lines) {
      const parts = line.split(",").map((s) => s.trim().replace(/^["']|["']$/g, ""));
      if (parts.length >= 2) {
        if (parts[0].toLowerCase() === "date") continue; // Header row
        parsed.push({ date: parts[0], name: parts[1] });
      }
    }

    if (parsed.length === 0) {
      setError("No valid holiday rows found in CSV (expected format: DD-MM-YYYY, Holiday Name)");
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch("/api/admin/holidays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ holidays: parsed }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "CSV import failed");
        setSubmitting(false);
        return;
      }

      setSuccess(`Successfully imported ${data.count} holiday(s).`);
      setCsvText("");
      setShowCsvBox(false);

      // Refresh list
      const getRes = await fetch("/api/admin/holidays");
      const getData = await getRes.json();
      if (getData.holidays) {
        setHolidays(getData.holidays);
      }
    } catch {
      setError("Network error during CSV import");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (date: string) => {
    if (!confirm(`Are you sure you want to delete holiday on ${formatISOtoDDMMYYYY(date)}?`)) return;

    try {
      const res = await fetch(`/api/admin/holidays?date=${encodeURIComponent(date)}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setHolidays((prev) => prev.filter((h) => h.date !== date));
        setSuccess(`Holiday on ${formatISOtoDDMMYYYY(date)} removed.`);
      }
    } catch {
      setError("Failed to delete holiday");
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded">
          {error}
        </div>
      )}
      {success && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs rounded">
          ✓ {success}
        </div>
      )}

      {/* Add Holiday & CSV Box */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Single Add */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
          <h3 className="font-bold text-sm text-slate-900 mb-3">
            Add Official Holiday
          </h3>
          <form onSubmit={handleAddSingle} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Date (DD-MM-YYYY)
              </label>
              <input
                type="text"
                placeholder="DD-MM-YYYY"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded text-xs text-slate-900"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Holiday Name / Occasion
              </label>
              <input
                type="text"
                placeholder="e.g. Diwali Holiday / College Foundation Day"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded text-xs text-slate-900"
                required
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded transition"
            >
              {submitting ? "Adding..." : "+ Add Holiday"}
            </button>
          </form>
        </div>

        {/* Bulk CSV Box */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-sm text-slate-900">
              Bulk Holiday Import (CSV)
            </h3>
            <button
              type="button"
              onClick={() => setShowCsvBox(!showCsvBox)}
              className="text-xs font-semibold text-slate-600 hover:text-slate-900 underline"
            >
              {showCsvBox ? "Hide CSV Area" : "Paste CSV"}
            </button>
          </div>

          {showCsvBox ? (
            <div className="space-y-3">
              <p className="text-[11px] text-slate-500">
                Format: <code className="bg-slate-100 px-1 py-0.5 rounded">date, name</code> (one per line, e.g. <code className="bg-slate-100 px-1 py-0.5 rounded">25-12-2026, Christmas</code>)
              </p>
              <textarea
                rows={4}
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                placeholder="date, name&#10;25-12-2026, Christmas&#10;01-01-2027, New Year's Day"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded text-xs text-slate-900 font-mono"
              />
              <button
                type="button"
                disabled={submitting || !csvText.trim()}
                onClick={handleCsvImport}
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-bold rounded transition"
              >
                {submitting ? "Importing..." : "Import CSV Rows"}
              </button>
            </div>
          ) : (
            <p className="text-xs text-slate-500">
              Import a whole academic calendar of holidays in one click. Excluded automatically from employee leave deductions and student working day counts.
            </p>
          )}
        </div>
      </div>

      {/* Holidays List Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
        <div className="px-5 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <h4 className="font-bold text-xs uppercase tracking-wide text-slate-700">
            Registered Official Holidays ({holidays.length})
          </h4>
        </div>
        {holidays.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            No holidays registered yet. Add official holidays above to exclude them from leave deductions.
          </div>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold">
              <tr>
                <th className="px-5 py-3">Date (DD-MM-YYYY)</th>
                <th className="px-5 py-3">Holiday Name</th>
                <th className="px-5 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {holidays.map((h) => (
                <tr key={h.date} className="hover:bg-slate-50/80 transition">
                  <td className="px-5 py-3 font-mono font-bold text-slate-900">
                    {formatISOtoDDMMYYYY(h.date)}
                  </td>
                  <td className="px-5 py-3 text-slate-800 font-medium">
                    {h.name}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => handleDelete(h.date)}
                      className="text-xs font-bold text-rose-600 hover:text-rose-800 hover:underline"
                    >
                      Delete ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
