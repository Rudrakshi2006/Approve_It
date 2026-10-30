"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ApprovalChain } from "@/lib/workflow/chains";

interface AppType {
  key: string;
  name: string;
  enabled: boolean;
  chain: ApprovalChain;
}

export function TypesClient({ initialTypes }: { initialTypes: AppType[] }) {
  const router = useRouter();
  const [types, setTypes] = useState(initialTypes);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleToggle = async (key: string, currentEnabled: boolean) => {
    setMessage(null);
    setLoadingKey(key);

    try {
      const res = await fetch(`/api/admin/types/${key}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !currentEnabled }),
      });

      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error || "Failed to update status" });
        return;
      }

      setTypes((prev) =>
        prev.map((t) => (t.key === key ? { ...t, enabled: !currentEnabled } : t))
      );
      setMessage({
        type: "success",
        text: `'${data.type.name}' is now ${!currentEnabled ? "ENABLED" : "PAUSED"}`,
      });
      router.refresh();
    } catch {
      setMessage({ type: "error", text: "Network error updating type status" });
    } finally {
      setLoadingKey(null);
    }
  };

  return (
    <div className="space-y-6">
      {message && (
        <div
          className={`p-4 rounded-lg text-sm font-medium border ${
            message.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-rose-50 text-rose-800 border-rose-200"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6">
        {types.map((t) => (
          <div
            key={t.key}
            className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm flex flex-col justify-between"
          >
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4 mb-4">
                <div>
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-base font-bold text-slate-900">{t.name}</h2>
                    <span className="font-mono text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                      key: {t.key}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Multi-step sequential approval chain configured in system.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <span
                    className={`text-xs font-bold px-3 py-1 rounded-full uppercase ${
                      t.enabled
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {t.enabled ? "Active / Enabled" : "Paused / Disabled"}
                  </span>

                  <button
                    onClick={() => handleToggle(t.key, t.enabled)}
                    disabled={loadingKey === t.key}
                    className={`text-xs font-bold px-3.5 py-1.5 rounded transition shadow-2xs ${
                      t.enabled
                        ? "bg-rose-50 border border-rose-300 text-rose-700 hover:bg-rose-100"
                        : "bg-emerald-700 text-white hover:bg-emerald-800"
                    }`}
                  >
                    {loadingKey === t.key
                      ? "Saving..."
                      : t.enabled
                      ? "Pause Applications"
                      : "Enable Applications"}
                  </button>
                </div>
              </div>

              {/* Chain Steps Visualizer */}
              <div>
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5">
                  Approval Steps Sequence ({t.chain.length} Steps)
                </h3>
                <div className="space-y-2">
                  {t.chain.map((step, idx) => (
                    <div
                      key={step.step_key}
                      className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-md text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-[10px]">
                          {idx + 1}
                        </span>
                        <div>
                          <span className="font-bold text-slate-900 mr-2">{step.label}</span>
                          <span className="font-mono text-[11px] text-slate-500">
                            ({step.step_key})
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="font-mono bg-indigo-50 border border-indigo-200 text-indigo-900 px-2 py-0.5 rounded text-[11px]">
                          resolver: {step.resolver.kind}
                        </span>
                        {step.can_reject === false && (
                          <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase">
                            Forward Only
                          </span>
                        )}
                        {step.attendance_required && (
                          <span className="bg-purple-100 text-purple-800 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase">
                            Attendance Check
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
