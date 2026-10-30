"use client";

import { useState } from "react";

interface EmployeeRow {
  login_id: string;
  name: string;
  department: string;
  designation: string;
  saturday_group: string;
  medical_balance: number;
  personal_balance: number;
}

export function LeaveBalancesClient({ employees }: { employees: EmployeeRow[] }) {
  const [list, setList] = useState(employees);
  const [selectedEmp, setSelectedEmp] = useState<EmployeeRow | null>(null);
  const [leaveType, setLeaveType] = useState<"medical" | "personal">("personal");
  const [changeDays, setChangeDays] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmp) return;

    setError(null);
    setSuccess(null);

    const days = parseFloat(changeDays);
    if (isNaN(days) || days === 0) {
      setError("Please enter a valid non-zero day change (e.g. 1.0, 2.0, -1.0)");
      return;
    }

    if (!note.trim()) {
      setError("Audit reason is required for administrative adjustments");
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch("/api/admin/leave/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          login_id: selectedEmp.login_id,
          leave_type: leaveType,
          change_days: days,
          note: note.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Adjustment failed");
        setSubmitting(false);
        return;
      }

      setSuccess(`Adjusted ${selectedEmp.name}'s ${leaveType} balance to ${data.balance_after} days.`);
      setList((prev) =>
        prev.map((emp) =>
          emp.login_id === selectedEmp.login_id
            ? {
                ...emp,
                [leaveType === "medical" ? "medical_balance" : "personal_balance"]: data.balance_after,
              }
            : emp
        )
      );

      setSelectedEmp(null);
      setChangeDays("");
      setNote("");
    } catch {
      setError("An unexpected network error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {success && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-md text-sm">
          ✓ {success}
        </div>
      )}

      {/* Adjust Modal / Drawer */}
      {selectedEmp && (
        <div className="bg-slate-50 border-2 border-slate-900 rounded-lg p-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
            <h3 className="font-bold text-sm text-slate-900">
              Adjust Leave Balance: {selectedEmp.name} ({selectedEmp.login_id})
            </h3>
            <button
              onClick={() => setSelectedEmp(null)}
              className="text-xs text-slate-500 hover:text-slate-800"
            >
              ✕ Close
            </button>
          </div>

          <form onSubmit={handleAdjust} className="space-y-4">
            {error && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Leave Type
                </label>
                <select
                  value={leaveType}
                  onChange={(e) => setLeaveType(e.target.value as any)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-xs text-slate-900"
                >
                  <option value="personal">Personal Leave (Current: {selectedEmp.personal_balance})</option>
                  <option value="medical">Medical Leave (Current: {selectedEmp.medical_balance})</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Change in Days (+ / -)
                </label>
                <input
                  type="number"
                  step="0.5"
                  placeholder="e.g. 1.0, 2.0, -1.0"
                  value={changeDays}
                  onChange={(e) => setChangeDays(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-xs text-slate-900"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Audit Note / Reason for Adjustment *
              </label>
              <input
                type="text"
                placeholder="e.g. Credit for unavailed holiday duty / correction"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-xs text-slate-900"
                required
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedEmp(null)}
                className="px-3 py-1.5 border border-slate-300 text-xs font-semibold rounded text-slate-700 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-bold rounded"
              >
                {submitting ? "Saving..." : "Commit Adjustment (Append-Only Audit)"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Employees Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold">
            <tr>
              <th className="px-4 py-3">Employee</th>
              <th className="px-4 py-3">Department</th>
              <th className="px-4 py-3">Saturday Group</th>
              <th className="px-4 py-3">Personal Balance</th>
              <th className="px-4 py-3">Medical Balance</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {list.map((emp) => (
              <tr key={emp.login_id} className="hover:bg-slate-50/80 transition">
                <td className="px-4 py-3">
                  <span className="font-bold text-slate-900 block">{emp.name}</span>
                  <span className="text-slate-500 font-mono text-[11px]">{emp.login_id} • {emp.designation}</span>
                </td>
                <td className="px-4 py-3 text-slate-700 font-medium">
                  {emp.department}
                </td>
                <td className="px-4 py-3">
                  <span className="bg-slate-100 font-mono text-slate-800 px-2 py-0.5 rounded font-bold uppercase">
                    {emp.saturday_group}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono font-bold text-slate-900">
                  {emp.personal_balance} <span className="font-normal text-slate-400">/ 12</span>
                </td>
                <td className="px-4 py-3 font-mono font-bold text-emerald-800">
                  {emp.medical_balance} <span className="font-normal text-slate-400">/ 12</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => {
                      setSelectedEmp(emp);
                      setError(null);
                    }}
                    className="text-xs font-bold text-slate-900 hover:text-slate-700 hover:underline"
                  >
                    Adjust Balance →
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
