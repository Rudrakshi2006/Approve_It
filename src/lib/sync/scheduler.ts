import "server-only";
import { getSyncConfig } from "./config";

/**
 * In-process scheduler (started from src/instrumentation.ts, Node runtime only):
 * - pull /api/sync/changes every EKLINK_SYNC_INTERVAL_MINUTES (default 15)
 * - full snapshot reconcile once a day at EKLINK_SYNC_FULL_AT (default 02:00, server local time)
 * Guarded against double start (hot reload / repeated register()); never throws.
 */

type SchedulerState = {
  started: boolean;
  startedAt: string | null;
  lastTickAt: string | null;
  lastFullDay: string | null;
  running: boolean;
  timers: Array<ReturnType<typeof setInterval> | ReturnType<typeof setTimeout>>;
};

const KEY = Symbol.for("approveit.syncScheduler");

export function schedulerState(): SchedulerState {
  const g = globalThis as unknown as Record<symbol, SchedulerState | undefined>;
  if (!g[KEY]) {
    g[KEY] = {
      started: false,
      startedAt: null,
      lastTickAt: null,
      lastFullDay: null,
      running: false,
      timers: [],
    };
  }
  return g[KEY]!;
}

function localDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** True when the daily full sync is due (time reached today and not yet run today). */
export function isFullSyncDue(
  now: Date,
  fullAt: { hour: number; minute: number },
  lastFullDay: string | null
): boolean {
  const today = localDay(now);
  if (lastFullDay === today) return false;
  const minutesNow = now.getHours() * 60 + now.getMinutes();
  return minutesNow >= fullAt.hour * 60 + fullAt.minute;
}

function unref(t: ReturnType<typeof setInterval> | ReturnType<typeof setTimeout>) {
  (t as { unref?: () => void }).unref?.();
}

async function safeRun(kind: "pull" | "full"): Promise<void> {
  const st = schedulerState();
  if (st.running) return;
  st.running = true;
  try {
    const { runPull, runFull } = await import("./runner");
    const { SupabaseSyncStore } = await import("./supabase-store");
    const deps = { store: new SupabaseSyncStore() };
    const res = kind === "full" ? await runFull(deps) : await runPull(deps);
    if (!res.ok && res.error) {
      console.warn(`[eklink-sync] ${kind} failed: ${res.error}`);
    }
  } catch (err) {
    console.warn(`[eklink-sync] ${kind} error: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    st.lastTickAt = new Date().toISOString();
    st.running = false;
  }
}

export function startSyncScheduler(): boolean {
  const st = schedulerState();
  if (st.started) return false;
  const cfg = getSyncConfig();
  if (!cfg.enabled) {
    console.info("[eklink-sync] scheduler not started (EkLink settings missing or EKLINK_SYNC_ENABLED=false)");
    return false;
  }
  st.started = true;
  st.startedAt = new Date().toISOString();
  const intervalMs = cfg.intervalMinutes * 60_000;

  const first = setTimeout(() => void safeRun("pull"), 30_000);
  unref(first);
  const pull = setInterval(() => void safeRun("pull"), intervalMs);
  unref(pull);
  const daily = setInterval(() => {
    const now = new Date();
    if (isFullSyncDue(now, cfg.fullAt, st.lastFullDay)) {
      st.lastFullDay = localDay(now);
      void safeRun("full");
    }
  }, 60_000);
  unref(daily);
  // Do not fire the daily full immediately on boot when the time already passed today;
  // boot already does a pull (and a snapshot on first run).
  if (isFullSyncDue(new Date(), cfg.fullAt, null)) st.lastFullDay = localDay(new Date());

  st.timers.push(first, pull, daily);
  console.info(
    `[eklink-sync] scheduler started: every ${cfg.intervalMinutes} min, full at ${String(cfg.fullAt.hour).padStart(2, "0")}:${String(cfg.fullAt.minute).padStart(2, "0")}`
  );
  return true;
}
