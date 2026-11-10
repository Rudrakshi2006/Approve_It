"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SyncStatus } from "@/lib/sync/status";
import type { StuckApplication } from "@/lib/sync/stuck";

function fmt(ts: string | null | undefined): string {
  if (!ts) return "never";
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? ts : d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
}

function Stat({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div className="border border-slate-200 rounded p-3 bg-slate-50">
      <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">{label}</div>
      <div className="text-sm font-bold text-slate-900 mt-0.5 break-all">{value ?? "—"}</div>
    </div>
  );
}

const REASON_LABEL: Record<StuckApplication["reason"], string> = {
  deactivated: "Approver deactivated",
  test_account: "Approver is a test account",
  deactivated_test_account: "Deactivated test account",
};

export function SyncClient({
  initialStatus,
  statusError,
  stuck,
}: {
  initialStatus: SyncStatus | null;
  statusError: string | null;
  stuck: StuckApplication[];
}) {
  const router = useRouter();
  const [status, setStatus] = useState<SyncStatus | null>(initialStatus);
  const [busy, setBusy] = useState<"run" | "full" | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [targets, setTargets] = useState<Record<string, string>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [reassigning, setReassigning] = useState<string | null>(null);

  const refresh = async () => {
    try {
      const res = await fetch("/api/admin/sync/status", { cache: "no-store" });
      if (res.ok) setStatus(await res.json());
    } catch {
      // keep the old status
    }
  };

  const trigger = async (kind: "run" | "full") => {
    setBusy(kind);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/sync/${kind}`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        setMessage({
          ok: true,
          text: `${kind === "full" ? "Full resync" : "Sync"} finished. Last event id: ${data.last_event_id}.`,
        });
      } else {
        setMessage({ ok: false, text: data.skipped || data.error || `Sync failed (HTTP ${res.status})` });
      }
    } catch {
      setMessage({ ok: false, text: "Network error while contacting ApproveIt" });
    } finally {
      setBusy(null);
      await refresh();
      router.refresh();
    }
  };

  const reassign = async (app: StuckApplication) => {
    const to = (targets[app.id] || "").trim();
    if (!to) {
      setMessage({ ok: false, text: "Enter the login ID of the new approver" });
      return;
    }
    setReassigning(app.id);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/applications/${app.id}/reassign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ new_approver_login_id: to, reason: reasons[app.id] || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setMessage({ ok: true, text: `"${app.subject}" reassigned to ${to}.` });
        router.refresh();
      } else {
        setMessage({ ok: false, text: data.error || `Reassign failed (HTTP ${res.status})` });
      }
    } catch {
      setMessage({ ok: false, text: "Network error while reassigning" });
    } finally {
      setReassigning(null);
    }
  };

  const st = status?.state;
  const lr = st?.last_result ?? null;

  return (
    <div className="space-y-6">
      {message && (
        <div
          className={`text-sm p-3 rounded border font-medium ${
            message.ok
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}
        >
          {message.text}
        </div>
      )}

      <section className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Sync status</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Pushes arrive instantly from EkLink; a pull runs every {status?.interval_minutes ?? 15} min and a
              full reconcile daily at {status?.full_at ?? "02:00"}.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => trigger("run")}
              disabled={busy !== null || !status?.configured}
              className="bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-bold px-4 py-2 rounded"
            >
              {busy === "run" ? "Syncing..." : "Sync now"}
            </button>
            <button
              onClick={() => trigger("full")}
              disabled={busy !== null || !status?.configured}
              className="border border-slate-300 hover:bg-slate-100 disabled:opacity-50 text-slate-900 text-xs font-bold px-4 py-2 rounded"
            >
              {busy === "full" ? "Resyncing..." : "Full resync"}
            </button>
          </div>
        </div>

        {statusError && <p className="text-xs text-rose-700 mb-3">{statusError}</p>}
        {status && !status.configured && (
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded p-2 mb-3">
            EkLink sync is not configured (EKLINK_URL / EKLINK_ISSUER / EKLINK_CLIENT_ID /
            EKLINK_CLIENT_SECRET) or EKLINK_SYNC_ENABLED=false. Pull is skipped.
          </p>
        )}
        {status && !status.migration_applied && (
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded p-2 mb-3">
            Database migration 0006_eklink_sync.sql has not been applied yet.
          </p>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Last event id" value={st?.last_event_id ?? 0} />
          <Stat label="Last push" value={fmt(st?.last_push_at)} />
          <Stat label="Last pull" value={fmt(st?.last_pull_at)} />
          <Stat label="Last full sync" value={fmt(st?.last_full_sync_at)} />
          <Stat label="People" value={status?.counts.people ?? null} />
          <Stat label="Linked to EkLink" value={status?.counts.people_linked ?? null} />
          <Stat label="Deactivated" value={status?.counts.people_inactive ?? null} />
          <Stat
            label="Test / Demo"
            value={`${status?.counts.people_test ?? "—"} / ${status?.counts.people_demo ?? "—"}`}
          />
          <Stat label="Directory units" value={status?.counts.directory_units ?? null} />
          <Stat
            label="Approver jobs (current)"
            value={`${status?.counts.approver_jobs ?? "—"} (${status?.counts.approver_jobs_current ?? "—"})`}
          />
          <Stat
            label="Scheduler"
            value={status?.scheduler.started ? `running since ${fmt(status.scheduler.started_at)}` : "not started"}
          />
          <Stat label="EkLink" value={status?.eklink_url ?? null} />
        </div>

        {st?.last_error && (
          <div className="mt-4 text-xs bg-rose-50 border border-rose-200 text-rose-800 rounded p-3 font-mono break-all">
            <span className="font-bold">Last error:</span> {st.last_error}
          </div>
        )}
        {lr && (
          <details className="mt-4 text-xs">
            <summary className="cursor-pointer font-semibold text-slate-700">
              Last result ({String(lr.kind ?? "")})
            </summary>
            <pre className="mt-2 bg-slate-50 border border-slate-200 rounded p-3 overflow-x-auto">
              {JSON.stringify(lr, null, 2)}
            </pre>
          </details>
        )}
      </section>

      <section className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
        <h2 className="text-base font-bold text-slate-900">Open applications needing reassignment</h2>
        <p className="text-xs text-slate-500 mt-0.5 mb-4">
          Applications in review whose current approver is deactivated or an ApproveIt-only test account.
          In-flight applications are never re-routed automatically.
        </p>
        {stuck.length === 0 ? (
          <p className="text-xs text-slate-500">None.</p>
        ) : (
          <div className="border border-slate-200 rounded overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold uppercase">
                <tr>
                  <th className="px-3 py-2">Application</th>
                  <th className="px-3 py-2">Step</th>
                  <th className="px-3 py-2">Waiting on</th>
                  <th className="px-3 py-2">Reassign to (login ID)</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stuck.map((a) => (
                  <tr key={a.id}>
                    <td className="px-3 py-2">
                      <a href={`/applications/${a.id}`} className="font-semibold text-indigo-700 hover:underline">
                        {a.subject}
                      </a>
                      <div className="text-[11px] text-slate-500">
                        {a.type} · by {a.applicant_login_id} · {fmt(a.created_at)}
                      </div>
                    </td>
                    <td className="px-3 py-2">{a.step_label ?? `#${a.current_step}`}</td>
                    <td className="px-3 py-2">
                      <div className="font-semibold">
                        {a.approver_name} ({a.approver_login_id})
                      </div>
                      <span className="inline-block mt-0.5 text-[10px] font-bold uppercase bg-amber-100 text-amber-900 rounded px-1.5 py-0.5">
                        {REASON_LABEL[a.reason]}
                      </span>
                    </td>
                    <td className="px-3 py-2 space-y-1">
                      <input
                        value={targets[a.id] ?? ""}
                        onChange={(e) => setTargets({ ...targets, [a.id]: e.target.value })}
                        placeholder="e.g. T004"
                        className="w-28 px-2 py-1 border border-slate-300 rounded font-mono"
                      />
                      <input
                        value={reasons[a.id] ?? ""}
                        onChange={(e) => setReasons({ ...reasons, [a.id]: e.target.value })}
                        placeholder="Reason (optional)"
                        className="w-full px-2 py-1 border border-slate-300 rounded"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => reassign(a)}
                        disabled={reassigning !== null}
                        className="bg-indigo-700 hover:bg-indigo-800 disabled:opacity-50 text-white font-bold px-3 py-1.5 rounded"
                      >
                        {reassigning === a.id ? "Saving..." : "Reassign"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
