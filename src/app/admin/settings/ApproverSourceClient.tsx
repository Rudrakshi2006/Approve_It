"use client";

import { useState } from "react";

type Source = "legacy" | "eklink";
type Dept = { org_code: string; institute_code: string | null; code: string; name: string };
type PreviewResult = { login_id: string | null; note: string | null };
type Preview = {
  steps: Array<{ step_key: string; label: string; kind: string; legacy: PreviewResult; eklink: PreviewResult }>;
  names: Record<string, string>;
};

function deptKeyOf(d: Dept): string {
  return `${d.org_code}/${d.institute_code ?? ""}/${d.code}`;
}

export function ApproverSourceClient({
  types,
  initialSources,
  departments,
}: {
  types: Array<{ key: string; name: string }>;
  initialSources: Record<string, Source>;
  departments: Dept[];
}) {
  const [sources, setSources] = useState<Record<string, Source>>(initialSources);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [previewType, setPreviewType] = useState<string>(types[0]?.key ?? "");
  const [deptKey, setDeptKey] = useState<string>(() => {
    const d = departments.find((x) => x.code === "CSE") ?? departments[0];
    return d ? deptKeyOf(d) : "//CSE";
  });
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const save = async (type: string, source: Source) => {
    setSaving(type);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/approver-source", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, source }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setSources(data.sources ?? { ...sources, [type]: source });
        setMessage({
          ok: true,
          text: `${type}: new applications now use ${source === "eklink" ? "EkLink jobs" : "legacy"} routing. Applications already in progress keep their routing.`,
        });
      } else {
        setMessage({ ok: false, text: data.error || `Failed to update ${type}` });
      }
    } catch {
      setMessage({ ok: false, text: "Network error" });
    } finally {
      setSaving(null);
    }
  };

  const runPreview = async () => {
    setLoadingPreview(true);
    setPreview(null);
    const [org, inst, dept] = deptKey.split("/");
    const params = new URLSearchParams({ preview: "1", type: previewType, org: org || "", inst: inst || "", dept: dept || "" });
    try {
      const res = await fetch(`/api/admin/approver-source?${params.toString()}`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setPreview(data);
      else setMessage({ ok: false, text: data.error || "Preview failed" });
    } catch {
      setMessage({ ok: false, text: "Network error" });
    } finally {
      setLoadingPreview(false);
    }
  };

  const who = (r: PreviewResult, names: Record<string, string>) =>
    r.login_id ? (
      <span className="font-semibold text-slate-900">
        {names[r.login_id] ?? r.login_id} ({r.login_id})
      </span>
    ) : (
      <span className="text-rose-700">{r.note}</span>
    );

  return (
    <div className="max-w-4xl bg-white border border-slate-200 rounded-lg p-6 shadow-sm space-y-5 mt-6">
      <div>
        <h2 className="text-base font-bold text-slate-900">Approver source per application type</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          <strong>Legacy</strong> uses ApproveIt roles, designations and assignments. <strong>EkLink jobs</strong>{" "}
          uses the approver jobs managed in EkLink (HOD of the department, Director of the institute, Exam Cell,
          Admin Staff, Event In-charge). If EkLink has nobody for a step, the applicant sees the usual &quot;contact
          admin&quot; message. The source is fixed when an application is submitted.
        </p>
      </div>

      {message && (
        <div
          className={`text-xs p-3 rounded border ${
            message.ok ? "bg-emerald-50 border-emerald-200 text-emerald-900" : "bg-rose-50 border-rose-200 text-rose-800"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="border border-slate-200 rounded divide-y divide-slate-100">
        {types.map((t) => {
          const current = sources[t.key] ?? "legacy";
          return (
            <div key={t.key} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <div>
                <div className="text-sm font-semibold text-slate-900">{t.name}</div>
                <div className="text-[11px] font-mono text-slate-500">{t.key}</div>
              </div>
              <div className="inline-flex rounded border border-slate-300 overflow-hidden text-xs font-bold">
                {(["legacy", "eklink"] as const).map((s) => (
                  <button
                    key={s}
                    disabled={saving !== null || current === s}
                    onClick={() => save(t.key, s)}
                    className={`px-3 py-1.5 ${
                      current === s ? "bg-slate-900 text-white" : "bg-white text-slate-700 hover:bg-slate-100"
                    } disabled:cursor-default`}
                  >
                    {s === "legacy" ? "Legacy" : "EkLink jobs"}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t border-slate-200 pt-4">
        <h3 className="text-sm font-bold text-slate-900 mb-2">Preview: who would be resolved</h3>
        <div className="flex flex-wrap gap-2 items-end">
          <select
            value={previewType}
            onChange={(e) => setPreviewType(e.target.value)}
            className="px-2 py-1.5 border border-slate-300 rounded text-xs"
          >
            {types.map((t) => (
              <option key={t.key} value={t.key}>
                {t.name}
              </option>
            ))}
          </select>
          {departments.length > 0 ? (
            <select
              value={deptKey}
              onChange={(e) => setDeptKey(e.target.value)}
              className="px-2 py-1.5 border border-slate-300 rounded text-xs"
            >
              {departments.map((d) => {
                const k = deptKeyOf(d);
                return (
                  <option key={k} value={k}>
                    {k} · {d.name}
                  </option>
                );
              })}
            </select>
          ) : (
            <input
              value={deptKey.split("/")[2] ?? ""}
              onChange={(e) => setDeptKey(`//${e.target.value.toUpperCase()}`)}
              placeholder="Department code, e.g. CSE"
              className="px-2 py-1.5 border border-slate-300 rounded text-xs w-48"
            />
          )}
          <button
            onClick={runPreview}
            disabled={loadingPreview || !previewType}
            className="bg-slate-900 text-white text-xs font-bold px-3 py-1.5 rounded disabled:opacity-50"
          >
            {loadingPreview ? "Resolving..." : "Preview"}
          </button>
        </div>

        {preview && (
          <table className="w-full text-left text-xs mt-3 border border-slate-200 rounded">
            <thead className="bg-slate-50 text-slate-600 uppercase font-semibold">
              <tr>
                <th className="px-3 py-2">Step</th>
                <th className="px-3 py-2">Legacy</th>
                <th className="px-3 py-2">EkLink jobs</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {preview.steps.map((s) => (
                <tr key={s.step_key}>
                  <td className="px-3 py-2">
                    <div className="font-semibold">{s.label}</div>
                    <div className="font-mono text-[11px] text-slate-500">{s.kind}</div>
                  </td>
                  <td className="px-3 py-2">{who(s.legacy, preview.names)}</td>
                  <td className="px-3 py-2">{who(s.eklink, preview.names)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
