import { getDb } from "@/lib/db";
import { getSyncConfig } from "@/lib/sync/config";

export type PeopleFilters = {
  q?: string;
  active?: string; // all | active | inactive
  test?: string; // all | test | real
  page?: string;
};

type Row = {
  login_id: string;
  eklink_sub: string | null;
  name: string;
  email: string;
  eklink_role: string;
  department: string | null;
  platform_role?: string | null;
  member_type?: string | null;
  org_code?: string | null;
  institute_code?: string | null;
  department_code?: string | null;
  is_active?: boolean | null;
  is_test?: boolean | null;
  is_demo?: boolean | null;
  saturday_group?: string | null;
};

const PAGE_SIZE = 100;

function qs(f: PeopleFilters, patch: Partial<PeopleFilters>): string {
  const merged = { ...f, ...patch };
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) {
    if (v && v !== "all" && !(k === "page" && v === "1")) p.set(k, v);
  }
  const s = p.toString();
  return s ? `?${s}` : "?";
}

/**
 * People directory (server-rendered). EkLink-owned fields are read-only for EkLink-linked
 * people (eklink_sub present) with a "Managed in EkLink" link; ApproveIt-only data
 * (Saturday group, leave balances, signatures) stays editable on their own pages.
 */
export async function PeopleDirectory({ filters }: { filters: PeopleFilters }) {
  const db = getDb();
  const eklinkUrl = getSyncConfig().eklinkUrl;
  const page = Math.max(1, Number(filters.page) || 1);
  const q = (filters.q || "").trim();

  const full =
    "login_id, eklink_sub, name, email, eklink_role, department, platform_role, member_type, org_code, institute_code, department_code, is_active, is_test, is_demo, saturday_group";

  const build = (columns: string, withNewFilters: boolean) => {
    let query = db
      .from("people")
      .select(columns, { count: "exact" })
      .order("name", { ascending: true })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
    if (q) {
      const safe = q.replace(/[%,()]/g, " ");
      query = query.or(`login_id.ilike.%${safe}%,name.ilike.%${safe}%,email.ilike.%${safe}%`);
    }
    if (withNewFilters) {
      if (filters.active === "active") query = query.eq("is_active", true);
      if (filters.active === "inactive") query = query.eq("is_active", false);
      if (filters.test === "test") query = query.eq("is_test", true);
      if (filters.test === "real") query = query.eq("is_test", false);
    }
    return query;
  };

  let migrationMissing = false;
  let res = await build(full, true);
  if (res.error) {
    migrationMissing = true;
    res = await build("login_id, eklink_sub, name, email, eklink_role, department, saturday_group", false);
  }
  const rows = (res.data ?? []) as unknown as Row[];
  const total = res.count ?? rows.length;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const select = "px-2 py-1.5 border border-slate-300 rounded text-xs bg-white";

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm mb-6">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">People directory</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {total} people. Identity, role, placement and active status are managed in EkLink for linked people.
          </p>
        </div>
        <form method="get" className="flex flex-wrap gap-2 items-end">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search login ID, name, email"
            className="px-2 py-1.5 border border-slate-300 rounded text-xs w-56"
          />
          <select name="active" defaultValue={filters.active || "all"} className={select}>
            <option value="all">Active + inactive</option>
            <option value="active">Active only</option>
            <option value="inactive">Deactivated only</option>
          </select>
          <select name="test" defaultValue={filters.test || "all"} className={select}>
            <option value="all">All accounts</option>
            <option value="real">Hide test accounts</option>
            <option value="test">Test accounts only</option>
          </select>
          <button type="submit" className="bg-slate-900 text-white text-xs font-bold px-3 py-1.5 rounded">
            Filter
          </button>
        </form>
      </div>

      {migrationMissing && (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded p-2 mb-3">
          Migration 0006_eklink_sync.sql is not applied yet: EkLink fields and filters are unavailable.
        </p>
      )}

      <div className="border border-slate-200 rounded overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-600 font-semibold uppercase">
            <tr>
              <th className="px-3 py-2">Person</th>
              <th className="px-3 py-2">Roles</th>
              <th className="px-3 py-2">Placement</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Owner</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((p) => (
              <tr key={p.login_id} className={p.is_active === false ? "bg-slate-50 text-slate-500" : ""}>
                <td className="px-3 py-2">
                  <div className="font-semibold text-slate-900">{p.name}</div>
                  <div className="font-mono text-[11px]">{p.login_id}</div>
                  <div className="text-[11px] text-slate-500">{p.email}</div>
                </td>
                <td className="px-3 py-2">
                  <div>
                    <span className="text-slate-500">Legacy:</span> {p.eklink_role}
                  </div>
                  <div>
                    <span className="text-slate-500">Platform:</span> {p.platform_role ?? "—"}
                  </div>
                  <div>
                    <span className="text-slate-500">Member:</span> {p.member_type ?? "—"}
                  </div>
                </td>
                <td className="px-3 py-2 font-mono text-[11px]">
                  {p.org_code || p.institute_code || p.department_code
                    ? [p.org_code, p.institute_code, p.department_code].filter(Boolean).join(" / ")
                    : (p.department ?? "—")}
                  {p.saturday_group && (
                    <div className="font-sans text-slate-500">Saturday group: {p.saturday_group}</div>
                  )}
                </td>
                <td className="px-3 py-2 space-x-1 whitespace-nowrap">
                  {p.is_active === false ? (
                    <span className="inline-block text-[10px] font-bold uppercase bg-rose-100 text-rose-800 rounded px-1.5 py-0.5">
                      Deactivated
                    </span>
                  ) : (
                    <span className="inline-block text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 rounded px-1.5 py-0.5">
                      Active
                    </span>
                  )}
                  {p.is_test && (
                    <span className="inline-block text-[10px] font-bold uppercase bg-amber-100 text-amber-900 rounded px-1.5 py-0.5">
                      Test
                    </span>
                  )}
                  {p.is_demo && (
                    <span className="inline-block text-[10px] font-bold uppercase bg-sky-100 text-sky-900 rounded px-1.5 py-0.5">
                      Demo
                    </span>
                  )}
                </td>
                <td className="px-3 py-2">
                  {p.eklink_sub ? (
                    eklinkUrl ? (
                      <a
                        href={`${eklinkUrl}/admin/users?login_id=${encodeURIComponent(p.login_id)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-indigo-700 font-semibold hover:underline"
                      >
                        Managed in EkLink ↗
                      </a>
                    ) : (
                      <span className="text-slate-500">Managed in EkLink</span>
                    )
                  ) : (
                    <span className="text-slate-500">ApproveIt only</span>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-center text-slate-500">
                  No people match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-between mt-3 text-xs">
          <span className="text-slate-500">
            Page {page} of {pages}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <a href={qs(filters, { page: String(page - 1) })} className="px-2 py-1 border rounded">
                Previous
              </a>
            )}
            {page < pages && (
              <a href={qs(filters, { page: String(page + 1) })} className="px-2 py-1 border rounded">
                Next
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
