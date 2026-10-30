"use client";

import { useState } from "react";

interface SettingsMap {
  fifth_saturday_working?: boolean;
  leave_cap_per_type?: number;
  monthly_accrual?: number;
}

export function SettingsClient({ initialSettings }: { initialSettings: SettingsMap }) {
  const [fifthSat, setFifthSat] = useState(Boolean(initialSettings.fifth_saturday_working));
  const [leaveCap, setLeaveCap] = useState(String(initialSettings.leave_cap_per_type ?? 12));
  const [monthlyAccrual, setMonthlyAccrual] = useState(String(initialSettings.monthly_accrual ?? 1));
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const saveSetting = async (key: string, value: unknown) => {
    setSavingKey(key);
    setMessage(null);

    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value }),
      });

      if (res.ok) {
        setMessage(`Setting "${key}" updated successfully!`);
      } else {
        setMessage(`Failed to update "${key}".`);
      }
    } catch {
      setMessage(`Network error updating "${key}".`);
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <div className="max-w-2xl bg-white border border-slate-200 rounded-lg p-6 shadow-sm space-y-6">
      {message && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs rounded">
          ✓ {message}
        </div>
      )}

      {/* 5th Saturday Toggle */}
      <div className="flex items-center justify-between pb-5 border-b border-slate-200 gap-4">
        <div>
          <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
            5th Saturday Working Status
          </label>
          <span className="text-xs text-slate-500 block mt-0.5">
            When enabled, months that contain a 5th Saturday will treat it as a working day. When disabled, 5th Saturday is an off-day for both groups.
          </span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="fifth-sat-check"
            checked={fifthSat}
            onChange={(e) => {
              const val = e.target.checked;
              setFifthSat(val);
              saveSetting("fifth_saturday_working", val);
            }}
            className="w-5 h-5 text-slate-900 rounded border-slate-300 focus:ring-slate-900 cursor-pointer"
          />
          <span className="text-xs font-bold text-slate-700">
            {fifthSat ? "Working" : "Off"}
          </span>
        </div>
      </div>

      {/* Leave Cap */}
      <div className="flex items-center justify-between pb-5 border-b border-slate-200 gap-4">
        <div>
          <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
            Leave Cap Per Type (Max Accumulation)
          </label>
          <span className="text-xs text-slate-500 block mt-0.5">
            Maximum number of leave days an employee can hold per leave category (Medical, Personal). Default: 12.
          </span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min="1"
            max="30"
            value={leaveCap}
            onChange={(e) => setLeaveCap(e.target.value)}
            className="w-20 px-2 py-1 bg-slate-50 border border-slate-300 rounded text-xs font-bold text-center"
          />
          <button
            type="button"
            disabled={savingKey === "leave_cap_per_type"}
            onClick={() => saveSetting("leave_cap_per_type", parseInt(leaveCap, 10))}
            className="px-3 py-1 bg-slate-900 text-white rounded text-xs font-bold hover:bg-slate-800"
          >
            Save
          </button>
        </div>
      </div>

      {/* Monthly Accrual */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
            Monthly Accrual Amount
          </label>
          <span className="text-xs text-slate-500 block mt-0.5">
            Days credited to active employees on the 1st of each calendar month. Default: 1.
          </span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min="0.5"
            step="0.5"
            max="5"
            value={monthlyAccrual}
            onChange={(e) => setMonthlyAccrual(e.target.value)}
            className="w-20 px-2 py-1 bg-slate-50 border border-slate-300 rounded text-xs font-bold text-center"
          />
          <button
            type="button"
            disabled={savingKey === "monthly_accrual"}
            onClick={() => saveSetting("monthly_accrual", parseFloat(monthlyAccrual))}
            className="px-3 py-1 bg-slate-900 text-white rounded text-xs font-bold hover:bg-slate-800"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
