import Link from "next/link";

export function AdminNav({ current }: { current: "assignments" | "people" | "types" }) {
  return (
    <div className="flex border-b border-slate-200 mb-6 gap-2">
      <Link
        href="/admin/assignments"
        className={`px-4 py-2 border-b-2 font-semibold text-sm transition ${
          current === "assignments"
            ? "border-slate-900 text-slate-900"
            : "border-transparent text-slate-500 hover:text-slate-700"
        }`}
      >
        Approver Assignments &amp; Roles
      </Link>
      <Link
        href="/admin/people"
        className={`px-4 py-2 border-b-2 font-semibold text-sm transition ${
          current === "people"
            ? "border-slate-900 text-slate-900"
            : "border-transparent text-slate-500 hover:text-slate-700"
        }`}
      >
        People CSV Import
      </Link>
      <Link
        href="/admin/types"
        className={`px-4 py-2 border-b-2 font-semibold text-sm transition ${
          current === "types"
            ? "border-slate-900 text-slate-900"
            : "border-transparent text-slate-500 hover:text-slate-700"
        }`}
      >
        Workflow Chains &amp; Types
      </Link>
    </div>
  );
}
