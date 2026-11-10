import {
  ApproverUpsertedSchema,
  DirectoryUpsertedSchema,
  LoginIdChangedSchema,
  PersonUpsertedSchema,
  emptyCounts,
  type ApproverUpserted,
  type DirectoryUpserted,
  type LoginIdChanged,
  type PersonUpserted,
  type SyncCounts,
  type SyncEvent,
} from "./types";
import type { ApproverJobRow, DirectoryRow, PersonRow, SyncStore } from "./store";

/**
 * Applies EkLink events / snapshots to the ApproveIt mirror (SYNC_CONTRACT.md sections 4 and 6).
 *
 * - Events are processed in ascending id; ids <= lastEventId are skipped.
 * - Every handler is an upsert by key (idempotent); unknown types are skipped but still
 *   advance last_event_id; invalid payloads and identity conflicts are counted, never fatal.
 * - Writes are buffered and flushed in FK-safe order (people -> directory -> approver jobs);
 *   a login_id rename flushes first so later events see the new key.
 */

const MAX_CONFLICTS = 50;

export type ApplyHooks = {
  /** Called for every person that becomes inactive (used to end sessions immediately). */
  onDeactivated?: (loginId: string) => void;
  /** Called for every person row written (cache invalidation). */
  onPersonWritten?: (loginId: string) => void;
  now?: () => Date;
};

class PeopleIndex {
  private bySub = new Map<string, PersonRow>();
  private byLogin = new Map<string, PersonRow>();
  private byEmail = new Map<string, PersonRow>();

  constructor(rows: PersonRow[]) {
    for (const r of rows) this.put(r);
  }

  put(row: PersonRow) {
    this.byLogin.set(row.login_id, row);
    if (row.eklink_sub) this.bySub.set(row.eklink_sub.toLowerCase(), row);
    if (row.email) this.byEmail.set(row.email.trim().toLowerCase(), row);
  }

  remove(row: PersonRow) {
    if (this.byLogin.get(row.login_id) === row) this.byLogin.delete(row.login_id);
    if (row.eklink_sub && this.bySub.get(row.eklink_sub.toLowerCase()) === row) {
      this.bySub.delete(row.eklink_sub.toLowerCase());
    }
    const em = row.email?.trim().toLowerCase();
    if (em && this.byEmail.get(em) === row) this.byEmail.delete(em);
  }

  sub(s: string | null | undefined) {
    return s ? this.bySub.get(s.toLowerCase()) : undefined;
  }
  login(l: string | null | undefined) {
    return l ? this.byLogin.get(l) : undefined;
  }
  email(e: string | null | undefined) {
    return e ? this.byEmail.get(e.trim().toLowerCase()) : undefined;
  }
}

export function directoryPath(d: {
  level: string;
  org_code: string | null;
  institute_code: string | null;
  code: string;
}): string {
  if (d.level === "organization") return d.code;
  if (d.level === "institute") return `${d.org_code ?? ""}/${d.code}`;
  return `${d.org_code ?? ""}/${d.institute_code ?? ""}/${d.code}`;
}

export class SyncApplier {
  readonly counts: SyncCounts = emptyCounts();
  private index: PeopleIndex | null = null;
  private pendingPeople = new Map<string, PersonRow>();
  private pendingDirectory = new Map<string, DirectoryRow>();
  private pendingJobs = new Map<string, ApproverJobRow>();
  private now: () => Date;

  constructor(
    private readonly store: SyncStore,
    private readonly hooks: ApplyHooks = {}
  ) {
    this.now = hooks.now ?? (() => new Date());
  }

  private conflict(msg: string) {
    if (this.counts.conflicts.length < MAX_CONFLICTS) this.counts.conflicts.push(msg);
  }

  private async people(): Promise<PeopleIndex> {
    if (!this.index) this.index = new PeopleIndex(await this.store.loadPeople());
    return this.index;
  }

  /** Applies one event (already filtered by id). Returns false for unknown/invalid events. */
  async applyEvent(ev: SyncEvent): Promise<boolean> {
    switch (ev.type) {
      case "person.upserted": {
        const p = PersonUpsertedSchema.safeParse(ev.data);
        if (!p.success) return this.invalid(ev);
        await this.applyPerson(p.data);
        return true;
      }
      case "person.login_id_changed": {
        const p = LoginIdChangedSchema.safeParse(ev.data);
        if (!p.success) return this.invalid(ev);
        await this.applyLoginIdChanged(p.data);
        return true;
      }
      case "directory.upserted": {
        const p = DirectoryUpsertedSchema.safeParse(ev.data);
        if (!p.success) return this.invalid(ev);
        this.applyDirectory(p.data);
        return true;
      }
      case "approver.upserted": {
        const p = ApproverUpsertedSchema.safeParse(ev.data);
        if (!p.success) return this.invalid(ev);
        await this.applyApprover(p.data);
        return true;
      }
      default:
        this.counts.skipped_unknown++;
        return false;
    }
  }

  private invalid(ev: SyncEvent): false {
    this.counts.invalid++;
    this.conflict(`event ${ev.id} (${ev.type}): invalid data`);
    return false;
  }

  async applyPerson(d: PersonUpserted): Promise<void> {
    const idx = await this.people();
    const email = d.email.trim().toLowerCase();

    const bySub = idx.sub(d.sub);
    let existing = bySub ?? idx.login(d.login_id) ?? idx.email(email);

    if (existing && existing.login_id !== d.login_id) {
      if (bySub) {
        // Same EkLink person, ApproveIt still has the old login_id (missed rename): follow EkLink.
        const taken = idx.login(d.login_id);
        if (taken && taken !== existing) {
          this.conflict(
            `person ${d.sub}: cannot rename ${existing.login_id} -> ${d.login_id} (login_id already used)`
          );
          return;
        }
        await this.rename(existing, d.login_id);
        existing = idx.login(d.login_id);
      } else {
        // Matched by email only, but login_ids differ: never rewrite a primary key on an email match.
        this.conflict(
          `person ${d.login_id}: email ${email} belongs to ApproveIt login_id ${existing.login_id}`
        );
        return;
      }
    }

    const nowIso = this.now().toISOString();
    const role = d.role.trim().toLowerCase();
    const wasActive = existing ? existing.is_active !== false : true;

    const row: PersonRow = {
      login_id: d.login_id,
      eklink_sub: d.sub,
      name: d.name,
      email,
      eklink_role: role,
      // ApproveIt routing compares `department` text with department codes.
      department: d.department_code ?? existing?.department ?? null,
      batch: d.batch ?? existing?.batch ?? null,
      section: d.section ?? existing?.section ?? null,
      semester: d.semester ?? existing?.semester ?? null,
      designation: d.designation ?? existing?.designation ?? null,
      platform_role: d.platform_role,
      member_type: d.member_type,
      org_code: d.org_code,
      institute_code: d.institute_code,
      department_code: d.department_code,
      is_active: d.is_active,
      is_demo: d.is_demo,
      deactivated_at: d.is_active
        ? null
        : existing && !wasActive
          ? (existing.deactivated_at ?? nowIso)
          : nowIso,
    };

    if (existing) {
      idx.remove(existing);
      this.counts.people_updated++;
    } else {
      this.counts.people_inserted++;
    }
    idx.put(row);
    this.pendingPeople.set(row.login_id, row);

    if (wasActive && !row.is_active) {
      this.counts.people_deactivated++;
      this.hooks.onDeactivated?.(row.login_id);
    }
    this.hooks.onPersonWritten?.(row.login_id);

    // Jobs for this person that are buffered without a login_id can be linked now.
    for (const job of this.pendingJobs.values()) {
      if (!job.person_login_id && job.person_sub && job.person_sub === d.sub) {
        job.person_login_id = row.login_id;
      }
    }
  }

  private async rename(existing: PersonRow, newLoginId: string): Promise<void> {
    const idx = await this.people();
    await this.flush();
    await this.store.renameLoginId(existing.login_id, newLoginId);
    idx.remove(existing);
    const renamed = { ...existing, login_id: newLoginId };
    idx.put(renamed);
    this.counts.login_ids_renamed++;
    this.hooks.onPersonWritten?.(existing.login_id);
    this.hooks.onPersonWritten?.(newLoginId);
  }

  async applyLoginIdChanged(d: LoginIdChanged): Promise<void> {
    const idx = await this.people();
    const person = idx.sub(d.sub) ?? idx.login(d.old_login_id);
    if (!person) {
      // Not mirrored yet; the next person.upserted / full resync brings it in under the new id.
      return;
    }
    if (person.login_id === d.new_login_id) return; // already applied (idempotent)
    const taken = idx.login(d.new_login_id);
    if (taken && taken !== person) {
      this.conflict(
        `login_id change ${d.old_login_id} -> ${d.new_login_id}: new login_id already used`
      );
      return;
    }
    await this.rename(person, d.new_login_id);
  }

  applyDirectory(d: DirectoryUpserted): void {
    let org = d.org_code;
    let inst = d.institute_code;
    if (d.level === "organization") {
      org = d.code;
      inst = null;
    } else if (d.level === "institute") {
      inst = d.code;
    }
    if (!org) {
      this.conflict(`directory ${d.level} ${d.code}: missing org_code`);
      return;
    }
    const row: DirectoryRow = {
      level: d.level,
      org_code: org,
      institute_code: inst,
      code: d.code,
      name: d.name,
      is_active: d.is_active,
      is_demo: d.is_demo,
      path: directoryPath({ level: d.level, org_code: org, institute_code: inst, code: d.code }),
    };
    this.pendingDirectory.set(row.path, row);
    this.counts.directory_upserted++;
  }

  async applyApprover(d: ApproverUpserted): Promise<void> {
    const idx = await this.people();
    const person = idx.sub(d.person_sub) ?? idx.login(d.login_id);
    const row: ApproverJobRow = {
      eklink_id: d.id,
      person_login_id: person?.login_id ?? null,
      person_sub: d.person_sub,
      title: d.title,
      scope_level: d.scope_level,
      org_code: d.org_code,
      institute_code: d.institute_code,
      department_code: d.department_code,
      scope_key: d.scope_key,
      valid_from: d.valid_from,
      valid_to: d.valid_to,
    };
    this.pendingJobs.set(row.eklink_id, row);
    this.counts.approvers_upserted++;
  }

  /** Writes buffered rows in FK-safe order. */
  async flush(): Promise<void> {
    if (this.pendingPeople.size > 0) {
      const rows = [...this.pendingPeople.values()];
      this.pendingPeople.clear();
      await this.store.upsertPeople(rows);
    }
    if (this.pendingDirectory.size > 0) {
      const rows = [...this.pendingDirectory.values()];
      this.pendingDirectory.clear();
      await this.store.upsertDirectory(rows);
    }
    if (this.pendingJobs.size > 0) {
      const rows = [...this.pendingJobs.values()];
      this.pendingJobs.clear();
      await this.store.upsertApproverJobs(rows);
    }
  }

  /** Links jobs stored earlier without a person (person arrived later). */
  async linkPendingJobs(): Promise<number> {
    const idx = await this.people();
    const unlinked = await this.store.loadUnlinkedJobs();
    let linked = 0;
    for (const j of unlinked) {
      const p = idx.sub(j.person_sub);
      if (p) {
        await this.store.setJobPerson(j.eklink_id, p.login_id);
        linked++;
      }
    }
    return linked;
  }
}

export type ApplyEventsResult = {
  lastEventId: number;
  counts: SyncCounts;
};

/**
 * Applies an ordered batch. Events with id <= lastEventId are skipped.
 * Returns the new last_event_id (max id seen, including unknown/invalid events).
 * On a storage error the error is thrown and the caller must NOT advance last_event_id
 * (re-applying is safe: everything is idempotent).
 */
export async function applyEvents(
  events: SyncEvent[],
  store: SyncStore,
  lastEventId: number,
  hooks: ApplyHooks = {}
): Promise<ApplyEventsResult> {
  const applier = new SyncApplier(store, hooks);
  const sorted = [...events].sort((a, b) => a.id - b.id);
  let last = lastEventId;
  applier.counts.received = sorted.length;

  for (const ev of sorted) {
    if (ev.id <= last) {
      applier.counts.skipped_old++;
      continue;
    }
    if (await applier.applyEvent(ev)) applier.counts.applied++;
    last = ev.id;
  }

  await applier.flush();
  if (applier.counts.people_inserted > 0) {
    await applier.linkPendingJobs();
  }
  return { lastEventId: last, counts: applier.counts };
}

export type SnapshotInput = {
  last_event_id: number;
  directory: unknown[];
  people: unknown[];
  approvers: unknown[];
};

/** Full reconcile from /api/sync/snapshot. Nothing is deleted; absent rows are left alone. */
export async function applySnapshot(
  snapshot: SnapshotInput,
  store: SyncStore,
  hooks: ApplyHooks = {}
): Promise<ApplyEventsResult> {
  const applier = new SyncApplier(store, hooks);
  const c = applier.counts;
  c.received = snapshot.directory.length + snapshot.people.length + snapshot.approvers.length;

  for (const raw of snapshot.directory) {
    const p = DirectoryUpsertedSchema.safeParse(raw);
    if (!p.success) {
      c.invalid++;
      continue;
    }
    applier.applyDirectory(p.data);
    c.applied++;
  }
  for (const raw of snapshot.people) {
    const p = PersonUpsertedSchema.safeParse(raw);
    if (!p.success) {
      c.invalid++;
      continue;
    }
    await applier.applyPerson(p.data);
    c.applied++;
  }
  for (const raw of snapshot.approvers) {
    const p = ApproverUpsertedSchema.safeParse(raw);
    if (!p.success) {
      c.invalid++;
      continue;
    }
    await applier.applyApprover(p.data);
    c.applied++;
  }

  await applier.flush();
  await applier.linkPendingJobs();
  return { lastEventId: snapshot.last_event_id, counts: c };
}
