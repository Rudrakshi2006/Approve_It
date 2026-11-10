import { redirect } from "next/navigation";
import { isSyncAdmin, requirePageSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { APPROVER_SOURCE_KEY, normalizeSourceMap } from "@/lib/workflow/approver-source";
import { AdminNav } from "../AdminNav";
import { SettingsClient } from "./SettingsClient";
import { ApproverSourceClient } from "./ApproverSourceClient";

export default async function AdminSettingsPage() {
  const session = await requirePageSession();
  const db = getDb();

  // ApproveIt "admin" / workflow_admin designation, or an EkLink platform admin.
  if (!(await isSyncAdmin(session))) {
    redirect("/inbox");
  }

  const [{ data: settingsRows }, { data: typeRows }, deptRes] = await Promise.all([
    db.from("app_settings").select("key, value"),
    db.from("application_types").select("key, name").order("key"),
    db
      .from("directory_units")
      .select("org_code, institute_code, code, name")
      .eq("level", "department")
      .eq("is_active", true)
      .order("path"),
  ]);

  const settingsMap: Record<string, unknown> = {};
  for (const row of settingsRows || []) {
    settingsMap[row.key] = row.value;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            App Settings &amp; Saturday Working Rules
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Configure institutional policies for leave caps, accruals, and 5th Saturday working rules.
          </p>
        </div>

        <AdminNav current="settings" />

        <SettingsClient initialSettings={settingsMap} />

        <ApproverSourceClient
          types={(typeRows ?? []) as Array<{ key: string; name: string }>}
          initialSources={normalizeSourceMap(settingsMap[APPROVER_SOURCE_KEY])}
          departments={
            (deptRes.error ? [] : (deptRes.data ?? [])) as Array<{
              org_code: string;
              institute_code: string | null;
              code: string;
              name: string;
            }>
          }
        />
      </div>
    </div>
  );
}
