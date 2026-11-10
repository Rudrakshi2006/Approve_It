import { getDb } from "@/lib/db";
import { getTodayIST } from "@/lib/date";
import { getSyncConfig } from "@/lib/sync/config";
import { isCurrentJob, type ApproverJob } from "@/lib/workflow/approver-source";

type PersonFlag = { login_id: string; name: string; is_active: boolean | null; is_test: boolean | null };

/**
 * Read-only mirror of EkLink approver jobs (edited in EkLink), shown beside the legacy
 * ApproveIt assignments, plus warnings for approvers that are deactivated / test accounts.
 */
export async function EklinkJobs() {
  const db = getDb();
  const eklinkUrl = getSyncConfig().eklinkUrl;
  const today = getTodayIST();

  const { data, error } = await db
    .from("approver_jobs")
    .select("*")
    .order("title", { ascending: true })
    .order("valid_from", { ascending: false });

  if (error) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm mt-6">
        <h2 className="text-base font-bold text-slate-900">EkLink approver jobs</h2>
        <p className="text-xs text-amber-800 mt-2">
          Not available yet: migration 0006_eklink_sync.sql has not been applied.
        </p>
      </div>
    );
  }

  const jobs = (data ?? []) as ApproverJob[];

  const [{ data: rolePeople }, { data: assignPeople }] = await Promise.all([
    db.from("app_roles").select("login_id, app_role"),
    db.from("approver_assignments").select("approver_login_id, application_type, step_key"),
  ]);
  const ids = new Set<string>();
  for (const j of jobs) if (j.person_login_id) ids.add(j.person_login_id);
  for (const r of (rolePeople ?? []) as Array<{ login_id: string }>) ids.add(r.login_id);
  for (const a of (assignPeople ?? []) as Array<{ approver_login_id: string }>) ids.add(a.approver_login_id);

  const people = new Map<string, PersonFlag>();
  if (ids.size > 0) {
    const { data: pRows } = await db
      .from("people")
      .select("login_id, name, is_active, is_test")
      .in("login_id", [...ids]);
    for (const p of (pRows ?? []) as PersonFlag[]) people.set(p.login_id, p);
  }

  const warnings: string[] = [];
  for (const r of (rolePeople ?? []) as Array<{ login_id: string; app_role: string }>) {
    const p = people.get(r.login_id);
    if (p && (p.is_active === false || p.is_test)) {
      warnings.push(
        `Legacy designation ${r.app_role} is held by ${p.name} (${p.login_id}), ${p.is_active === false ? "deactivated" : "a test account"}.`
      );
    }
  }
  for (const a of (assignPeople ?? []) as Array<{ approver_login_id: string; application_type: string; step_key: string }>) {
    const p = people.get(a.approver_login_id);
    if (p && (p.is_active === false || p.is_test)) {
      warnings.push(
        `Legacy assignment ${a.application_type}/${a.step_key} points to ${p.name} (${p.login_id}), ${p.is_active === false ? "deactivated" : "a test account"}.`
      );
    }
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm mt-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">EkLink approver jobs</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Read-only mirror. Used for routing by application types whose approver source is &quot;EkLink jobs&quot;
            (App Settings). Edit jobs in EkLink.
          </p>
        </div>
        {eklinkUrl && (
          <a
            href={`${eklinkUrl}/admin/approvers`}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-semibold text-indigo-700 hover:underline"
          >
            Managed in EkLink ↗
          </a>
        )}
      </div>

      {warnings.length > 0 && (
        <ul className="mb-4 text-xs bg-amber-50 border border-amber-200 text-amber-900 rounded p-3 list-disc pl-6 space-y-1">
          {warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}

      {jobs.length === 0 ? (
        <p className="text-xs text-slate-500">No approver jobs synced from EkLink yet.</p>
      ) : (
        <div className="border border-slate-200 rounded overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold uppercase">
              <tr>
                <th className="px-3 py-2">Job</th>
                <th className="px-3 py-2">Scope</th>
                <th className="px-3 py-2">Person</th>
                <th className="px-3 py-2">Valid</th>
                <th className="px-3 py-2">State</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {jobs.map((j) => {
                const p = j.person_login_id ? people.get(j.person_login_id) : undefined;
                const current = isCurrentJob(j, today);
                const needsReassign = current && (!p || p.is_active === false);
                return (
                  <tr key={j.eklink_id} className={current ? "" : "text-slate-400"}>
                    <td className="px-3 py-2 font-semibold">
                      {j.title}
                      {j.scope_key && <span className="ml-1 font-mono text-[11px]">[{j.scope_key}]</span>}
                    </td>
                    <td className="px-3 py-2 font-mono text-[11px]">
                      {j.scope_level}: {[j.org_code, j.institute_code, j.department_code].filter(Boolean).join(" / ")}
                    </td>
                    <td className="px-3 py-2">
                      {p ? `${p.name} (${p.login_id})` : j.person_login_id ?? <em>not in ApproveIt yet</em>}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {j.valid_from} → {j.valid_to ?? "open"}
                    </td>
                    <td className="px-3 py-2">
                      {needsReassign ? (
                        <span className="text-[10px] font-bold uppercase bg-rose-100 text-rose-800 rounded px-1.5 py-0.5">
                          {p ? "Person deactivated: reassign in EkLink" : "Person missing"}
                        </span>
                      ) : current ? (
                        <span className="text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 rounded px-1.5 py-0.5">
                          Current
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold uppercase bg-slate-100 text-slate-600 rounded px-1.5 py-0.5">
                          {j.valid_from > today ? "Upcoming" : "Ended"}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
