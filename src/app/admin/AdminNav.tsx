import Link from "next/link";

export function AdminNav({
  current,
}: {
  current: "assignments" | "people" | "types" | "leave-balances" | "holidays" | "settings";
}) {
  return (
    <div className="flex flex-wrap border-b border-slate-200 mb-6 gap-2">
      <Link
        href="/admin/assignments"
        className={`px-3 py-2 border-b-2 font-semibold text-xs sm:text-sm transition ${
          current === "assignments"
            ? "border-slate-900 text-slate-900"
            : "border-transparent text-slate-500 hover:text-slate-700"
        }`}
      >
        Assignments &amp; Roles
      </Link>
      <Link
        href="/admin/people"
        className={`px-3 py-2 border-b-2 font-semibold text-xs sm:text-sm transition ${
          current === "people"
            ? "border-slate-900 text-slate-900"
            : "border-transparent text-slate-500 hover:text-slate-700"
        }`}
      >
        People Import
      </Link>
      <Link
        href="/admin/types"
        className={`px-3 py-2 border-b-2 font-semibold text-xs sm:text-sm transition ${
          current === "types"
            ? "border-slate-900 text-slate-900"
            : "border-transparent text-slate-500 hover:text-slate-700"
        }`}
      >
        Workflow Chains
      </Link>
      <Link
        href="/admin/leave-balances"
        className={`px-3 py-2 border-b-2 font-semibold text-xs sm:text-sm transition ${
          current === "leave-balances"
            ? "border-slate-900 text-slate-900"
            : "border-transparent text-slate-500 hover:text-slate-700"
        }`}
      >
        Leave Balances
      </Link>
      <Link
        href="/admin/holidays"
        className={`px-3 py-2 border-b-2 font-semibold text-xs sm:text-sm transition ${
          current === "holidays"
            ? "border-slate-900 text-slate-900"
            : "border-transparent text-slate-500 hover:text-slate-700"
        }`}
      >
        Holidays Roster
      </Link>
      <Link
        href="/admin/settings"
        className={`px-3 py-2 border-b-2 font-semibold text-xs sm:text-sm transition ${
          current === "settings"
            ? "border-slate-900 text-slate-900"
            : "border-transparent text-slate-500 hover:text-slate-700"
        }`}
      >
        App Settings
      </Link>
    </div>
  );
}
