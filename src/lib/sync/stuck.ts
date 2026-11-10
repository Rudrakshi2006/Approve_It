import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getDb } from "../db";

export type StuckApplication = {
  id: string;
  type: string;
  subject: string;
  status: string;
  current_step: number;
  step_label: string | null;
  created_at: string;
  applicant_login_id: string;
  approver_login_id: string;
  approver_name: string | null;
  reason: "deactivated" | "test_account" | "deactivated_test_account";
};

/**
 * Open applications (in_review) whose current approver is deactivated or an ApproveIt-only
 * test account. They need an admin reassignment (nothing is re-routed automatically).
 * Returns [] before migration 0006 is applied.
 */
export async function listStuckApplications(client?: SupabaseClient): Promise<StuckApplication[]> {
  const db = client ?? getDb();
  const { data: flagged, error } = await db
    .from("people")
    .select("login_id, name, is_active, is_test")
    .or("is_active.eq.false,is_test.eq.true");
  if (error || !flagged || flagged.length === 0) return [];

  const byId = new Map(
    (flagged as Array<{ login_id: string; name: string; is_active: boolean; is_test: boolean }>).map(
      (p) => [p.login_id, p]
    )
  );

  const out: StuckApplication[] = [];
  const ids = [...byId.keys()];
  for (let i = 0; i < ids.length; i += 200) {
    const { data: apps } = await db
      .from("applications")
      .select("id, type, subject, status, current_step, chain_snapshot, created_at, applicant_login_id, current_approver_login_id")
      .eq("status", "in_review")
      .in("current_approver_login_id", ids.slice(i, i + 200))
      .order("created_at", { ascending: true });
    for (const a of (apps ?? []) as Array<Record<string, unknown>>) {
      const approver = byId.get(String(a.current_approver_login_id));
      if (!approver) continue;
      const chain = Array.isArray(a.chain_snapshot) ? (a.chain_snapshot as Array<{ label?: string }>) : [];
      const inactive = approver.is_active === false;
      out.push({
        id: String(a.id),
        type: String(a.type),
        subject: String(a.subject),
        status: String(a.status),
        current_step: Number(a.current_step ?? 0),
        step_label: chain[Number(a.current_step ?? 0)]?.label ?? null,
        created_at: String(a.created_at),
        applicant_login_id: String(a.applicant_login_id),
        approver_login_id: approver.login_id,
        approver_name: approver.name ?? null,
        reason: inactive && approver.is_test
          ? "deactivated_test_account"
          : inactive
            ? "deactivated"
            : "test_account",
      });
    }
  }
  return out;
}
