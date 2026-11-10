import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getDb } from "../db";
import {
  PERSON_COLUMNS,
  type ApproverJobRow,
  type DirectoryRow,
  type PersonRow,
  type SyncStateRow,
  type SyncStatePatch,
  type SyncStore,
} from "./store";

const CHUNK = 200;
const PAGE = 1000;

function chunks<T>(rows: T[], size = CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
}

function fail(what: string, err: { message?: string } | null): never {
  throw new Error(`${what}: ${err?.message ?? "unknown error"}`);
}

export class SupabaseSyncStore implements SyncStore {
  constructor(private readonly db: SupabaseClient = getDb()) {}

  async loadPeople(): Promise<PersonRow[]> {
    const out: PersonRow[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await this.db
        .from("people")
        .select(PERSON_COLUMNS.join(", "))
        .order("login_id", { ascending: true })
        .range(from, from + PAGE - 1);
      if (error) fail("load people", error);
      const rows = (data ?? []) as unknown as PersonRow[];
      out.push(...rows);
      if (rows.length < PAGE) break;
    }
    return out;
  }

  async upsertPeople(rows: PersonRow[]): Promise<void> {
    const now = new Date().toISOString();
    for (const part of chunks(rows)) {
      const { error } = await this.db
        .from("people")
        .upsert(
          part.map((r) => ({ ...r, updated_at: now })),
          { onConflict: "login_id" }
        );
      if (error) fail("upsert people", error);
    }
  }

  async renameLoginId(oldLoginId: string, newLoginId: string): Promise<void> {
    const { error } = await this.db
      .from("people")
      .update({ login_id: newLoginId, updated_at: new Date().toISOString() })
      .eq("login_id", oldLoginId);
    if (error) fail("rename login_id", error);
  }

  async upsertDirectory(rows: DirectoryRow[]): Promise<void> {
    const now = new Date().toISOString();
    for (const part of chunks(rows)) {
      const { error } = await this.db
        .from("directory_units")
        .upsert(
          part.map((r) => ({ ...r, updated_at: now })),
          { onConflict: "path" }
        );
      if (error) fail("upsert directory_units", error);
    }
  }

  async upsertApproverJobs(rows: ApproverJobRow[]): Promise<void> {
    const now = new Date().toISOString();
    for (const part of chunks(rows)) {
      const { error } = await this.db
        .from("approver_jobs")
        .upsert(
          part.map((r) => ({ ...r, updated_at: now })),
          { onConflict: "eklink_id" }
        );
      if (error) fail("upsert approver_jobs", error);
    }
  }

  async loadUnlinkedJobs(): Promise<Array<{ eklink_id: string; person_sub: string | null }>> {
    const { data, error } = await this.db
      .from("approver_jobs")
      .select("eklink_id, person_sub")
      .is("person_login_id", null)
      .not("person_sub", "is", null);
    if (error) fail("load unlinked approver_jobs", error);
    return (data ?? []) as Array<{ eklink_id: string; person_sub: string | null }>;
  }

  async setJobPerson(eklinkId: string, loginId: string): Promise<void> {
    const { error } = await this.db
      .from("approver_jobs")
      .update({ person_login_id: loginId })
      .eq("eklink_id", eklinkId);
    if (error) fail("link approver_job", error);
  }

  async getState(): Promise<SyncStateRow> {
    const { data, error } = await this.db
      .from("sync_state")
      .select("last_event_id, last_pull_at, last_push_at, last_full_sync_at, last_error, last_result")
      .eq("id", 1)
      .maybeSingle();
    if (error) fail("read sync_state", error);
    if (!data) {
      return {
        last_event_id: 0,
        last_pull_at: null,
        last_push_at: null,
        last_full_sync_at: null,
        last_error: null,
        last_result: null,
      };
    }
    return { ...(data as SyncStateRow), last_event_id: Number(data.last_event_id ?? 0) };
  }

  async saveState(patch: SyncStatePatch): Promise<void> {
    const { error } = await this.db
      .from("sync_state")
      .upsert({ id: 1, ...patch, updated_at: new Date().toISOString() }, { onConflict: "id" });
    if (error) fail("write sync_state", error);
  }
}
