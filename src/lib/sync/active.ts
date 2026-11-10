import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getDb } from "../db";

/**
 * people.is_active check used by the session helpers (one cheap indexed lookup, cached
 * for a few seconds). The sync applier invalidates the cache when someone is
 * deactivated, so in-process pushes take effect immediately.
 *
 * Fails open (treats the person as active) when the lookup errors or times out, e.g.
 * before migration 0006 is applied, so existing logins keep working.
 */

const TTL_MS = 15_000;
const TIMEOUT_MS = 2_500;

type Cache = Map<string, { active: boolean; at: number }>;
const KEY = Symbol.for("approveit.activeCache");

function cache(): Cache {
  const g = globalThis as unknown as Record<symbol, Cache | undefined>;
  if (!g[KEY]) g[KEY] = new Map();
  return g[KEY]!;
}

export function invalidateActiveCache(loginId?: string): void {
  if (loginId) cache().delete(loginId);
  else cache().clear();
}

export async function isPersonActive(loginId: string, client?: SupabaseClient): Promise<boolean> {
  const hit = cache().get(loginId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.active;

  try {
    const db = client ?? getDb();
    const lookup = db
      .from("people")
      .select("is_active")
      .eq("login_id", loginId)
      .maybeSingle()
      .then((r) => r);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), TIMEOUT_MS);
      (timer as { unref?: () => void }).unref?.();
    });
    const res = await Promise.race([lookup, timeout]);
    if (timer) clearTimeout(timer);
    if (!res || res.error) return true; // fail open (column missing / DB unreachable)
    const active = !res.data || (res.data as { is_active?: boolean }).is_active !== false;
    cache().set(loginId, { active, at: Date.now() });
    return active;
  } catch {
    return true;
  }
}
