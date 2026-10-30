import Link from "next/link";

export function DevRoleBar() {
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

  return (
    <div className="bg-amber-500 text-slate-900 border-b border-amber-600 px-3 py-1 text-[11px] font-medium flex items-center justify-between overflow-x-auto select-none z-50">
      <div className="flex items-center gap-2 shrink-0">
        <span className="bg-amber-900 text-amber-100 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide">
          DEV QUICK-SWITCH
        </span>
        <span className="hidden sm:inline text-amber-950 font-semibold">
          Click any persona to instantly test as that person:
        </span>
      </div>
      <div className="flex items-center gap-1.5 shrink-0 overflow-x-auto py-0.5">
        {roles.map((r) => (
          <a
            key={r.id}
            href={`/api/dev/session?id=${r.id}`}
            className="px-2 py-0.5 rounded bg-amber-100 hover:bg-white text-slate-900 hover:text-black font-semibold border border-amber-400 shadow-xs transition shrink-0"
          >
            {r.label}
          </a>
        ))}
      </div>
    </div>
  );
}
