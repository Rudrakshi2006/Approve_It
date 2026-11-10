import "server-only";
import { applyEvents, applySnapshot, type ApplyHooks } from "./apply";
import { fetchChanges, fetchSnapshot, type FetchLike } from "./client";
import { getSyncConfig } from "./config";
import { invalidateActiveCache } from "./active";
import type { SyncStore } from "./store";
import type { SyncCounts, SyncEvent } from "./types";

/**
 * Orchestrates push, pull ("Sync now") and full snapshot ("Full resync").
 * All sync work in this process is serialized by one lock so events are always applied
 * in id order (a push never races a pull).
 */

const LOCK_KEY = Symbol.for("approveit.syncLock");
const MAX_PULL_PAGES = 200;

type LockHolder = { tail: Promise<unknown> };

function lockHolder(): LockHolder {
  const g = globalThis as unknown as Record<symbol, LockHolder | undefined>;
  if (!g[LOCK_KEY]) g[LOCK_KEY] = { tail: Promise.resolve() };
  return g[LOCK_KEY]!;
}

export function withSyncLock<T>(fn: () => Promise<T>): Promise<T> {
  const holder = lockHolder();
  const run = holder.tail.then(fn, fn);
  holder.tail = run.catch(() => undefined);
  return run;
}

export type RunDeps = {
  store: SyncStore;
  fetchImpl?: FetchLike;
  hooks?: ApplyHooks;
};

export type RunResult = {
  ok: boolean;
  skipped?: string;
  last_event_id: number;
  counts?: SyncCounts;
  pages?: number;
  error?: string;
};

function defaultHooks(extra?: ApplyHooks): ApplyHooks {
  return {
    ...extra,
    onDeactivated: (loginId) => {
      invalidateActiveCache(loginId);
      extra?.onDeactivated?.(loginId);
    },
    onPersonWritten: (loginId) => {
      invalidateActiveCache(loginId);
      extra?.onPersonWritten?.(loginId);
    },
  };
}

function mergeCounts(a: SyncCounts | undefined, b: SyncCounts): SyncCounts {
  if (!a) return b;
  const out = { ...a, conflicts: [...a.conflicts, ...b.conflicts].slice(0, 50) };
  for (const k of Object.keys(b) as Array<keyof SyncCounts>) {
    if (k !== "conflicts") (out[k] as number) = (a[k] as number) + (b[k] as number);
  }
  return out;
}

function errMsg(err: unknown): string {
  return (err instanceof Error ? err.message : String(err)).slice(0, 500);
}

async function recordError(store: SyncStore, err: unknown) {
  try {
    await store.saveState({ last_error: `${new Date().toISOString()} ${errMsg(err)}` });
  } catch {
    // ignore: never crash on bookkeeping
  }
}

type LoopResult = { last: number; counts?: SyncCounts; pages: number };

/** Pulls /api/sync/changes pages from `from` until has_more is false. */
async function changesLoop(deps: RunDeps, from: number, swallowErrors: boolean): Promise<LoopResult> {
  const { store } = deps;
  const hooks = defaultHooks(deps.hooks);
  let last = from;
  let counts: SyncCounts | undefined;
  let pages = 0;
  try {
    while (pages < MAX_PULL_PAGES) {
      const res = await fetchChanges(last, { fetchImpl: deps.fetchImpl });
      pages++;
      const applied = await applyEvents(res.events, store, last, hooks);
      counts = mergeCounts(counts, applied.counts);
      last = Math.max(last, applied.lastEventId);
      await store.saveState({ last_event_id: last });
      if (!res.has_more || res.events.length === 0) break;
    }
  } catch (err) {
    if (!swallowErrors) throw err;
    // The next scheduled pull continues from `last`.
    await recordError(store, err);
  }
  return { last, counts, pages };
}

async function pullInner(deps: RunDeps): Promise<RunResult> {
  const { store } = deps;
  const state = await store.getState();

  if (state.last_event_id === 0 && !state.last_full_sync_at) {
    // First run: start from the snapshot (contract 5.2), then continue with changes.
    return fullInner(deps);
  }

  const loop = await changesLoop(deps, state.last_event_id, false);
  const now = new Date().toISOString();
  await store.saveState({
    last_pull_at: now,
    last_error: null,
    last_result: { kind: "changes", at: now, pages: loop.pages, ...(loop.counts ?? {}) },
  });
  return { ok: true, last_event_id: loop.last, counts: loop.counts, pages: loop.pages };
}

async function fullInner(deps: RunDeps): Promise<RunResult> {
  const { store } = deps;
  const hooks = defaultHooks(deps.hooks);
  const snap = await fetchSnapshot({ fetchImpl: deps.fetchImpl });
  const state = await store.getState();
  const applied = await applySnapshot(snap, store, hooks);
  const last = Math.max(state.last_event_id, snap.last_event_id);
  const now = new Date().toISOString();
  await store.saveState({
    last_event_id: last,
    last_full_sync_at: now,
    last_pull_at: now,
    last_error: null,
    last_result: { kind: "snapshot", at: now, ...applied.counts },
  });

  // Catch up with anything that happened after the snapshot was taken.
  const loop = await changesLoop(deps, last, true);
  return {
    ok: true,
    last_event_id: loop.last,
    counts: loop.counts ? mergeCounts(applied.counts, loop.counts) : applied.counts,
    pages: loop.pages,
  };
}

/** "Sync now" / interval pull. Never throws. */
export async function runPull(deps: RunDeps): Promise<RunResult> {
  const cfg = getSyncConfig();
  if (!cfg.enabled) return { ok: false, skipped: "EkLink sync is not configured or disabled", last_event_id: 0 };
  return withSyncLock(async () => {
    try {
      return await pullInner(deps);
    } catch (err) {
      await recordError(deps.store, err);
      return { ok: false, error: errMsg(err), last_event_id: (await safeState(deps.store)).last_event_id };
    }
  });
}

/** "Full resync" / daily reconcile. Never throws. */
export async function runFull(deps: RunDeps): Promise<RunResult> {
  const cfg = getSyncConfig();
  if (!cfg.enabled) return { ok: false, skipped: "EkLink sync is not configured or disabled", last_event_id: 0 };
  return withSyncLock(async () => {
    try {
      return await fullInner(deps);
    } catch (err) {
      await recordError(deps.store, err);
      return { ok: false, error: errMsg(err), last_event_id: (await safeState(deps.store)).last_event_id };
    }
  });
}

async function safeState(store: SyncStore) {
  try {
    return await store.getState();
  } catch {
    return { last_event_id: 0 };
  }
}

/**
 * Applies a verified push batch. If the batch starts after a gap (or this is the very
 * first sync) a pull/snapshot catch-up runs first so nothing is skipped; if that catch-up
 * fails the batch is still applied (the daily full reconcile repairs any hole).
 * Throws on storage errors (the endpoint answers 500 and EkLink retries).
 */
export async function handlePushedEvents(
  events: SyncEvent[],
  deps: RunDeps
): Promise<{ last_event_id: number; counts: SyncCounts }> {
  return withSyncLock(async () => {
    const { store } = deps;
    const hooks = defaultHooks(deps.hooks);
    try {
      let state = await store.getState();
      const newer = events.filter((e) => e.id > state.last_event_id).sort((a, b) => a.id - b.id);
      const cfg = getSyncConfig();

      if (newer.length > 0 && cfg.enabled) {
        const firstRun = state.last_event_id === 0 && !state.last_full_sync_at;
        const gap = newer[0].id > state.last_event_id + 1;
        if (firstRun || gap) {
          try {
            if (firstRun) await fullInner(deps);
            else await changesLoop(deps, state.last_event_id, true);
          } catch (err) {
            await recordError(store, err);
          }
          state = await store.getState();
        }
      }

      const applied = await applyEvents(events, store, state.last_event_id, hooks);
      const last = Math.max(state.last_event_id, applied.lastEventId);
      const now = new Date().toISOString();
      await store.saveState({
        last_event_id: last,
        last_push_at: now,
        last_error: null,
        last_result: { kind: "push", at: now, ...applied.counts },
      });
      return { last_event_id: last, counts: applied.counts };
    } catch (err) {
      await recordError(store, err);
      throw err;
    }
  });
}
