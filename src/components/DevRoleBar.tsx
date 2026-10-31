"use client";

import { useState } from "react";
import Link from "next/link";

export function DevRoleBar() {
  const [switchingId, setSwitchingId] = useState<string | null>(null);

  if (process.env.NODE_ENV === "production") {
    return null;
  }

  const roles = [
    { label: "🎓 Akshat (Student)", id: "24070521003", role: "Student" },
    { label: "🏢 Ramesh Pawar (Admin Staff)", id: "STA5001", role: "Staff" },
    { label: "👩‍🏫 Dr. Mrudula Nimbarte", id: "T017", role: "Faculty" },
    { label: "👨‍🏫 Dr. Sachin Harne (Incharge)", id: "T036", role: "Faculty" },
    { label: "🏛️ Dr. Sagarkumar / Jasjit (HOD)", id: "T004", role: "HOD" },
    { label: "🎓 Dr. Ketan / Nitin (Director)", id: "T001", role: "Director" },
    { label: "📝 Dr. Pradnya (Exam Cell)", id: "T009", role: "Exam" },
  ];

  const handleSwitch = (id: string) => {
    if (switchingId) return;
    setSwitchingId(id);

    const currentPath =
      typeof window !== "undefined"
        ? window.location.pathname + window.location.search
        : "/";

    window.location.href = `/api/dev/session?id=${encodeURIComponent(id)}&redirect=${encodeURIComponent(currentPath)}`;
  };

  return (
    <div className="bg-amber-500 text-slate-900 border-b border-amber-600 px-3 py-1 text-[11px] font-medium flex items-center justify-between overflow-x-auto select-none z-50">
      <div className="flex items-center gap-2 shrink-0">
        <span className="bg-amber-900 text-amber-100 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide">
          DEV QUICK-SWITCH
        </span>
        <span className="hidden sm:inline text-amber-950 font-semibold">
          Click any persona to test as that person:
        </span>
      </div>
      <div className="flex items-center gap-1.5 shrink-0 overflow-x-auto py-0.5">
        {roles.map((r) => {
          const isCurrent = switchingId === r.id;
          return (
            <button
              key={r.id}
              type="button"
              disabled={!!switchingId}
              onClick={() => handleSwitch(r.id)}
              className={`px-2 py-0.5 rounded text-slate-900 font-semibold border border-amber-400 shadow-xs transition shrink-0 cursor-pointer disabled:opacity-60 disabled:cursor-wait ${
                isCurrent
                  ? "bg-amber-300 ring-2 ring-amber-700 font-bold"
                  : "bg-amber-100 hover:bg-white hover:text-black"
              }`}
            >
              {isCurrent ? `⏳ Switching...` : r.label}
            </button>
          );
        })}
        <Link
          href="/notifications"
          className="px-2 py-0.5 rounded bg-amber-200 hover:bg-white text-amber-950 font-bold border border-amber-500 shadow-xs transition shrink-0 ml-1"
        >
          🔔 Open Notifications
        </Link>
      </div>
    </div>
  );
}
