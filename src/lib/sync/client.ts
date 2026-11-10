import { getSyncConfig, type SyncConfig } from "./config";
import {
  ChangesResponseSchema,
  SnapshotResponseSchema,
  type ChangesResponse,
  type SnapshotResponse,
} from "./types";

/** Pull client for EkLink /api/sync/changes and /api/sync/snapshot (SYNC_CONTRACT.md 5.2). */

export class SyncPullError extends Error {
  constructor(
    message: string,
    public readonly status?: number
  ) {
    super(message);
    this.name = "SyncPullError";
  }
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

function basicAuth(cfg: SyncConfig): string {
  return `Basic ${Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`, "utf8").toString("base64")}`;
}

async function getJson(
  url: string,
  cfg: SyncConfig,
  fetchImpl: FetchLike,
  timeoutMs: number
): Promise<unknown> {
  let res: Response;
  try {
    res = await fetchImpl(url, {
      method: "GET",
      headers: { authorization: basicAuth(cfg), accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    const reason = err instanceof Error ? err.name : "network_error";
    throw new SyncPullError(`EkLink unreachable (${reason})`);
  }
  if (!res.ok) {
    throw new SyncPullError(
      res.status === 401 ? "EkLink rejected client credentials (401)" : `EkLink HTTP ${res.status}`,
      res.status
    );
  }
  try {
    return await res.json();
  } catch {
    throw new SyncPullError("EkLink returned invalid JSON");
  }
}

export async function fetchChanges(
  after: number,
  opts: { limit?: number; fetchImpl?: FetchLike; config?: SyncConfig } = {}
): Promise<ChangesResponse> {
  const cfg = opts.config ?? getSyncConfig();
  const limit = opts.limit ?? 500;
  const url = `${cfg.eklinkUrl}/api/sync/changes?after=${encodeURIComponent(String(after))}&limit=${limit}`;
  const json = await getJson(url, cfg, opts.fetchImpl ?? fetch, 30_000);
  const parsed = ChangesResponseSchema.safeParse(json);
  if (!parsed.success) throw new SyncPullError("EkLink changes response has an unexpected shape");
  return parsed.data;
}

export async function fetchSnapshot(
  opts: { fetchImpl?: FetchLike; config?: SyncConfig } = {}
): Promise<SnapshotResponse> {
  const cfg = opts.config ?? getSyncConfig();
  const json = await getJson(`${cfg.eklinkUrl}/api/sync/snapshot`, cfg, opts.fetchImpl ?? fetch, 120_000);
  const parsed = SnapshotResponseSchema.safeParse(json);
  if (!parsed.success) throw new SyncPullError("EkLink snapshot response has an unexpected shape");
  return parsed.data;
}
