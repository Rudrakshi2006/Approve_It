import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getDb } from "../db";
import { getTodayIST } from "../date";
import { getSyncConfig } from "./config";
import { schedulerState } from "./scheduler";

export type SyncStatus = {
  configured: boolean;
  eklink_url: string | null;
  interval_minutes: number;
  full_at: string;
  scheduler: { started: boolean; started_at: string | null; last_tick_at: string | null; running: boolean };
  migration_applied: boolean;
  state: {
    last_event_id: number;
    last_pull_at: string | null;
    last_push_at: string | null;
    last_full_sync_at: string | null;
    last_error: string | null;
    last_result: Record<string, unknown> | null;
  } | null;
  counts: {
    people: number | null;
    people_linked: number | null;
    people_inactive: number | null;
    people_test: number | null;
    people_demo: number | null;
    directory_units: number | null;
    approver_jobs: number | null;
    approver_jobs_current: number | null;
  };
};

async function count(
  q: PromiseLike<{ count: number | null; error: unknown }>
): Promise<number | null> {
  try {
    const { count: c, error } = await q;
    return error ? null : (c ?? 0);
  } catch {
    return null;
  }
}

export async function getSyncStatus(client?: SupabaseClient): Promise<SyncStatus> {
  const db = client ?? getDb();
  const cfg = getSyncConfig();
  const sched = schedulerState();
  const today = getTodayIST();

  const { data: stateRow, error: stateErr } = await db
    .from("sync_state")
    .select("last_event_id, last_pull_at, last_push_at, last_full_sync_at, last_error, last_result")
    .eq("id", 1)
    .maybeSingle();

  const head = { count: "exact" as const, head: true };
  const [people, linked, inactive, test, demo, dir, jobs, jobsCurrent] = await Promise.all([
    count(db.from("people").select("login_id", head)),
    count(db.from("people").select("login_id", head).not("eklink_sub", "is", null)),
    count(db.from("people").select("login_id", head).eq("is_active", false)),
    count(db.from("people").select("login_id", head).eq("is_test", true)),
    count(db.from("people").select("login_id", head).eq("is_demo", true)),
    count(db.from("directory_units").select("id", head)),
    count(db.from("approver_jobs").select("eklink_id", head)),
    count(
      db
        .from("approver_jobs")
        .select("eklink_id", head)
        .lte("valid_from", today)
        .or(`valid_to.is.null,valid_to.gte.${today}`)
    ),
  ]);

  return {
    configured: cfg.enabled,
    eklink_url: cfg.eklinkUrl || null,
    interval_minutes: cfg.intervalMinutes,
    full_at: `${String(cfg.fullAt.hour).padStart(2, "0")}:${String(cfg.fullAt.minute).padStart(2, "0")}`,
    scheduler: {
      started: sched.started,
      started_at: sched.startedAt,
      last_tick_at: sched.lastTickAt,
      running: sched.running,
    },
    migration_applied: !stateErr,
    state: stateRow
      ? {
          last_event_id: Number(stateRow.last_event_id ?? 0),
          last_pull_at: stateRow.last_pull_at ?? null,
          last_push_at: stateRow.last_push_at ?? null,
          last_full_sync_at: stateRow.last_full_sync_at ?? null,
          last_error: stateRow.last_error ?? null,
          last_result: (stateRow.last_result as Record<string, unknown> | null) ?? null,
        }
      : null,
    counts: {
      people,
      people_linked: linked,
      people_inactive: inactive,
      people_test: test,
      people_demo: demo,
      directory_units: dir,
      approver_jobs: jobs,
      approver_jobs_current: jobsCurrent,
    },
  };
}
