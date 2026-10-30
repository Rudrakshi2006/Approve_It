import { redirect } from "next/navigation";
import { requirePageSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { AdminNav } from "../AdminNav";
import { SettingsClient } from "./SettingsClient";

export default async function AdminSettingsPage() {
  const session = await requirePageSession();
  const db = getDb();

  const { data: adminRole } = await db
    .from("app_roles")
    .select("app_role")
    .eq("login_id", session.login_id)
    .eq("app_role", "admin")
    .maybeSingle();

  if (!adminRole) {
    redirect("/inbox");
  }

  const { data: settingsRows } = await db.from("app_settings").select("key, value");

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
      </div>
    </div>
  );
}
