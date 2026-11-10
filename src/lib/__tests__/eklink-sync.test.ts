import { describe, expect, it, beforeAll, beforeEach } from "vitest";
import { generateKeyPair, exportJWK, createLocalJWKSet, SignJWT } from "jose";
import { applyEvents, applySnapshot } from "../sync/apply";
import { verifyEventsJwt, EVENTS_JWT_TYP } from "../sync/jwt";
import { handlePushedEvents, runPull } from "../sync/runner";
import type {
  ApproverJobRow,
  DirectoryRow,
  PersonRow,
  SyncStateRow,
  SyncStore,
} from "../sync/store";
import type { SyncEvent } from "../sync/types";

// ---------------------------------------------------------------------------
// In-memory store
// ---------------------------------------------------------------------------
class MemoryStore implements SyncStore {
  people = new Map<string, PersonRow & Record<string, unknown>>();
  directory = new Map<string, DirectoryRow>();
  jobs = new Map<string, ApproverJobRow>();
  state: SyncStateRow = {
    last_event_id: 0,
    last_pull_at: null,
    last_push_at: null,
    last_full_sync_at: null,
    last_error: null,
    last_result: null,
  };
  writes = 0;

  async loadPeople() {
    return [...this.people.values()].map((p) => ({ ...p }));
  }
  async upsertPeople(rows: PersonRow[]) {
    this.writes++;
    for (const r of rows) {
      const prev = this.people.get(r.login_id) ?? {};
      this.people.set(r.login_id, { ...prev, ...r });
    }
  }
  async renameLoginId(oldId: string, newId: string) {
    const p = this.people.get(oldId);
    if (!p) return;
    if (this.people.has(newId)) throw new Error("duplicate key");
    this.people.delete(oldId);
    this.people.set(newId, { ...p, login_id: newId });
    for (const j of this.jobs.values()) if (j.person_login_id === oldId) j.person_login_id = newId; // ON UPDATE CASCADE
  }
  async upsertDirectory(rows: DirectoryRow[]) {
    for (const r of rows) this.directory.set(r.path, { ...r });
  }
  async upsertApproverJobs(rows: ApproverJobRow[]) {
    for (const r of rows) {
      if (r.person_login_id && !this.people.has(r.person_login_id)) throw new Error("FK violation");
      this.jobs.set(r.eklink_id, { ...r });
    }
  }
  async loadUnlinkedJobs() {
    return [...this.jobs.values()]
      .filter((j) => !j.person_login_id && j.person_sub)
      .map((j) => ({ eklink_id: j.eklink_id, person_sub: j.person_sub }));
  }
  async setJobPerson(id: string, loginId: string) {
    const j = this.jobs.get(id);
    if (j) j.person_login_id = loginId;
  }
  async getState() {
    return { ...this.state };
  }
  async saveState(patch: Partial<SyncStateRow>) {
    this.state = { ...this.state, ...patch };
  }
}

const SUB_HOD = "11111111-1111-4111-8111-111111111111";
const SUB_STU = "22222222-2222-4222-8222-222222222222";
const JOB_HOD = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function person(over: Record<string, unknown> = {}) {
  return {
    sub: SUB_HOD,
    login_id: "T004",
    email: "T004@sitnagpur.siu.edu.in",
    name: "Dr. HOD",
    role: "hod",
    platform_role: "faculty",
    member_type: "faculty",
    org_code: "SIU",
    institute_code: "SIT",
    department_code: "CSE",
    batch: null,
    section: null,
    semester: null,
    designation: null,
    is_active: true,
    is_demo: false,
    ...over,
  };
}

function ev(id: number, type: string, data: unknown): SyncEvent {
  return { id, type, at: "2026-11-09T10:00:00Z", data };
}

function existingRow(over: Partial<PersonRow> & Record<string, unknown> = {}) {
  return {
    login_id: "T004",
    eklink_sub: null,
    name: "Old Name",
    email: "t004@sitnagpur.siu.edu.in",
    eklink_role: "faculty",
    department: "CSE",
    batch: null,
    section: null,
    semester: null,
    designation: "Professor",
    platform_role: null,
    member_type: null,
    org_code: null,
    institute_code: null,
    department_code: null,
    is_active: true,
    is_demo: false,
    deactivated_at: null,
    signature_path: "sig/t004.png",
    saturday_group: "odd",
    ...over,
  };
}

function setSyncEnv(enabled: boolean) {
  process.env.EKLINK_URL = "https://eklink-test.example";
  process.env.EKLINK_ISSUER = "https://eklink-test.example";
  process.env.EKLINK_CLIENT_ID = "approveit-client";
  process.env.EKLINK_CLIENT_SECRET = enabled ? "secret" : "";
  process.env.EKLINK_SYNC_ENABLED = enabled ? "true" : "false";
}

// ---------------------------------------------------------------------------
describe("EkLink sync: event application", () => {
  let store: MemoryStore;
  beforeEach(() => {
    store = new MemoryStore();
  });

  it("person.upserted inserts a new person with codes, legacy role and department = department_code", async () => {
    const res = await applyEvents([ev(1, "person.upserted", person())], store, 0);
    expect(res.lastEventId).toBe(1);
    const p = store.people.get("T004")!;
    expect(p.eklink_sub).toBe(SUB_HOD);
    expect(p.eklink_role).toBe("hod");
    expect(p.platform_role).toBe("faculty");
    expect(p.department).toBe("CSE");
    expect(p.department_code).toBe("CSE");
    expect(p.email).toBe("t004@sitnagpur.siu.edu.in");
    expect(res.counts.people_inserted).toBe(1);
  });

  it("matches an existing person by login_id, links sub and keeps ApproveIt-only data", async () => {
    store.people.set("T004", existingRow());
    await applyEvents([ev(1, "person.upserted", person())], store, 0);
    const p = store.people.get("T004")!;
    expect(p.eklink_sub).toBe(SUB_HOD);
    expect(p.name).toBe("Dr. HOD");
    expect(p.signature_path).toBe("sig/t004.png");
    expect(p.saturday_group).toBe("odd");
    expect(p.designation).toBe("Professor"); // null from EkLink keeps existing
    expect(store.people.size).toBe(1);
  });

  it("matches by email when sub and login_id are unknown, but never rewrites a login_id on an email match", async () => {
    store.people.set("X1", existingRow({ login_id: "X1", email: "t004@sitnagpur.siu.edu.in" }));
    const res = await applyEvents([ev(1, "person.upserted", person())], store, 0);
    expect(store.people.has("T004")).toBe(false);
    expect(store.people.get("X1")!.eklink_sub).toBeNull();
    expect(res.counts.conflicts[0]).toMatch(/belongs to ApproveIt login_id X1/);
    expect(res.lastEventId).toBe(1); // never fails the batch
  });

  it("is idempotent and skips ids <= last_event_id", async () => {
    const batch = [ev(1, "person.upserted", person()), ev(2, "person.upserted", person({ name: "Dr. New" }))];
    const first = await applyEvents(batch, store, 0);
    expect(first.lastEventId).toBe(2);
    const snapshot = JSON.stringify([...store.people.values()].map(({ name, login_id }) => ({ name, login_id })));

    const again = await applyEvents(batch, store, first.lastEventId);
    expect(again.counts.skipped_old).toBe(2);
    expect(again.counts.applied).toBe(0);
    expect(again.lastEventId).toBe(2);
    expect(JSON.stringify([...store.people.values()].map(({ name, login_id }) => ({ name, login_id })))).toBe(snapshot);

    // Re-applying the same event with a lower stored id gives the same state (upsert by key).
    await applyEvents(batch, store, 0);
    expect(store.people.size).toBe(1);
    expect(store.people.get("T004")!.name).toBe("Dr. New");
  });

  it("applies out-of-order input in ascending id order (newest state wins)", async () => {
    const batch = [
      ev(3, "person.upserted", person({ name: "Third" })),
      ev(1, "person.upserted", person({ name: "First" })),
      ev(2, "person.upserted", person({ name: "Second" })),
    ];
    const res = await applyEvents(batch, store, 0);
    expect(res.lastEventId).toBe(3);
    expect(store.people.get("T004")!.name).toBe("Third");
  });

  it("skips unknown types and invalid payloads but still advances last_event_id", async () => {
    const res = await applyEvents(
      [ev(5, "something.new", {}), ev(6, "person.upserted", { sub: "not-a-uuid" })],
      store,
      4
    );
    expect(res.lastEventId).toBe(6);
    expect(res.counts.skipped_unknown).toBe(1);
    expect(res.counts.invalid).toBe(1);
  });

  it("person.login_id_changed renames the person (FKs cascade) and is idempotent", async () => {
    await applyEvents(
      [
        ev(1, "person.upserted", person()),
        ev(2, "approver.upserted", {
          id: JOB_HOD,
          person_sub: SUB_HOD,
          login_id: "T004",
          title: "HOD",
          scope_level: "department",
          org_code: "SIU",
          institute_code: "SIT",
          department_code: "CSE",
          scope_key: null,
          valid_from: "2026-01-01",
          valid_to: null,
        }),
      ],
      store,
      0
    );
    const change = ev(3, "person.login_id_changed", { sub: SUB_HOD, old_login_id: "T004", new_login_id: "T004X" });
    const res = await applyEvents([change], store, 2);
    expect(res.counts.login_ids_renamed).toBe(1);
    expect(store.people.has("T004")).toBe(false);
    expect(store.people.get("T004X")!.eklink_sub).toBe(SUB_HOD);
    expect(store.jobs.get(JOB_HOD)!.person_login_id).toBe("T004X");

    const again = await applyEvents([change], store, 0);
    expect(again.counts.login_ids_renamed).toBe(0);
  });

  it("person.upserted with a new login_id for a known sub follows EkLink (missed rename)", async () => {
    await applyEvents([ev(1, "person.upserted", person())], store, 0);
    await applyEvents([ev(2, "person.upserted", person({ login_id: "SU-T004" }))], store, 1);
    expect(store.people.has("T004")).toBe(false);
    expect(store.people.get("SU-T004")!.name).toBe("Dr. HOD");
  });

  it("deactivation sets is_active=false, deactivated_at and fires the session hook", async () => {
    const deactivated: string[] = [];
    await applyEvents([ev(1, "person.upserted", person())], store, 0);
    const res = await applyEvents([ev(2, "person.upserted", person({ is_active: false }))], store, 1, {
      onDeactivated: (id) => deactivated.push(id),
    });
    expect(deactivated).toEqual(["T004"]);
    expect(res.counts.people_deactivated).toBe(1);
    expect(store.people.get("T004")!.is_active).toBe(false);
    expect(store.people.get("T004")!.deactivated_at).toBeTruthy();
    // No new deactivation on re-delivery
    const again = await applyEvents([ev(3, "person.upserted", person({ is_active: false }))], store, 2, {
      onDeactivated: (id) => deactivated.push(id),
    });
    expect(again.counts.people_deactivated).toBe(0);
  });

  it("directory.upserted upserts by path for every level", async () => {
    await applyEvents(
      [
        ev(1, "directory.upserted", { level: "organization", code: "SIU", name: "SIU", org_code: "SIU", institute_code: null, is_active: true, is_demo: false }),
        ev(2, "directory.upserted", { level: "institute", code: "SIT", name: "SIT", org_code: "SIU", institute_code: "SIT", is_active: true, is_demo: false }),
        ev(3, "directory.upserted", { level: "department", code: "cse", name: "CSE", org_code: "SIU", institute_code: "SIT", is_active: true, is_demo: false }),
        ev(4, "directory.upserted", { level: "department", code: "CSE", name: "Computer Science", org_code: "SIU", institute_code: "SIT", is_active: true, is_demo: false }),
      ],
      store,
      0
    );
    expect([...store.directory.keys()].sort()).toEqual(["SIU", "SIU/SIT", "SIU/SIT/CSE"]);
    expect(store.directory.get("SIU/SIT/CSE")!.name).toBe("Computer Science");
  });

  it("an approver job that arrives before its person is linked when the person arrives", async () => {
    await applyEvents(
      [
        ev(1, "approver.upserted", {
          id: JOB_HOD,
          person_sub: SUB_HOD,
          login_id: "T004",
          title: "HOD",
          scope_level: "department",
          org_code: "SIU",
          institute_code: "SIT",
          department_code: "CSE",
          scope_key: null,
          valid_from: "2026-01-01",
          valid_to: null,
        }),
      ],
      store,
      0
    );
    expect(store.jobs.get(JOB_HOD)!.person_login_id).toBeNull();
    await applyEvents([ev(2, "person.upserted", person())], store, 1);
    expect(store.jobs.get(JOB_HOD)!.person_login_id).toBe("T004");
  });

  it("snapshot reconcile upserts everything and deletes nothing", async () => {
    store.people.set("STU1001", existingRow({ login_id: "STU1001", email: "aarav@sitnagpur.edu.in" }));
    const res = await applySnapshot(
      {
        last_event_id: 42,
        directory: [{ level: "organization", code: "SIU", name: "SIU", org_code: "SIU", institute_code: null }],
        people: [person(), person({ sub: SUB_STU, login_id: "24070521003", email: "s@x.in", role: "student", member_type: "student", platform_role: "student" })],
        approvers: [],
      },
      store
    );
    expect(res.lastEventId).toBe(42);
    expect(store.people.size).toBe(3);
    expect(store.people.has("STU1001")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
describe("EkLink sync: push / pull orchestration", () => {
  beforeEach(() => setSyncEnv(true));

  it("push after a gap first pulls the missing events, then applies the batch", async () => {
    const store = new MemoryStore();
    store.state.last_event_id = 5;
    store.state.last_full_sync_at = "2026-11-01T00:00:00Z";
    const calls: string[] = [];
    const fetchImpl = async (url: string) => {
      calls.push(url);
      return new Response(
        JSON.stringify({ events: [ev(6, "person.upserted", person({ name: "From pull" }))], last_event_id: 6, has_more: false }),
        { status: 200 }
      );
    };
    const res = await handlePushedEvents([ev(9, "person.upserted", person({ name: "From push" }))], {
      store,
      fetchImpl,
    });
    expect(calls[0]).toContain("/api/sync/changes?after=5");
    expect(res.last_event_id).toBe(9);
    expect(store.state.last_event_id).toBe(9);
    expect(store.people.get("T004")!.name).toBe("From push");
  });

  it("push still applies when the catch-up pull fails (network error is recorded, not fatal)", async () => {
    const store = new MemoryStore();
    store.state.last_event_id = 5;
    store.state.last_full_sync_at = "2026-11-01T00:00:00Z";
    const res = await handlePushedEvents([ev(9, "person.upserted", person())], {
      store,
      fetchImpl: async () => {
        throw new TypeError("fetch failed");
      },
    });
    expect(res.last_event_id).toBe(9);
    expect(store.people.has("T004")).toBe(true);
  });

  it("pull sends Basic client credentials and follows has_more", async () => {
    const store = new MemoryStore();
    store.state.last_event_id = 1;
    store.state.last_full_sync_at = "2026-11-01T00:00:00Z";
    const auths: string[] = [];
    let n = 0;
    const fetchImpl = async (_url: string, init?: RequestInit) => {
      auths.push(String((init?.headers as Record<string, string>).authorization));
      n++;
      const body =
        n === 1
          ? { events: [ev(2, "person.upserted", person())], last_event_id: 2, has_more: true }
          : { events: [ev(3, "person.upserted", person({ name: "Page 2" }))], last_event_id: 3, has_more: false };
      return new Response(JSON.stringify(body), { status: 200 });
    };
    const res = await runPull({ store, fetchImpl });
    expect(res.ok).toBe(true);
    expect(res.last_event_id).toBe(3);
    expect(auths[0]).toBe(`Basic ${Buffer.from("approveit-client:secret").toString("base64")}`);
    expect(store.people.get("T004")!.name).toBe("Page 2");
    expect(store.state.last_pull_at).toBeTruthy();
  });

  it("pull never throws on network errors and records last_error", async () => {
    const store = new MemoryStore();
    store.state.last_event_id = 1;
    store.state.last_full_sync_at = "2026-11-01T00:00:00Z";
    const res = await runPull({
      store,
      fetchImpl: async () => {
        throw new TypeError("fetch failed");
      },
    });
    expect(res.ok).toBe(false);
    expect(store.state.last_error).toMatch(/EkLink unreachable/);
  });

  it("pull is skipped when EkLink settings are missing", async () => {
    setSyncEnv(false);
    const res = await runPull({ store: new MemoryStore() });
    expect(res.ok).toBe(false);
    expect(res.skipped).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
describe("EkLink sync: pushed events JWT verification (ES256)", () => {
  let keys: Awaited<ReturnType<typeof generateKeyPair>>;
  let otherKeys: Awaited<ReturnType<typeof generateKeyPair>>;
  let jwks: ReturnType<typeof createLocalJWKSet>;

  beforeAll(async () => {
    setSyncEnv(true);
    keys = await generateKeyPair("ES256");
    otherKeys = await generateKeyPair("ES256");
    const jwk = await exportJWK(keys.publicKey);
    jwk.kid = "eklink-key-1";
    jwk.alg = "ES256";
    jwks = createLocalJWKSet({ keys: [jwk] });
  });

  const sign = (
    over: { typ?: string; aud?: string; iss?: string; exp?: string | number; key?: CryptoKey } = {}
  ) =>
    new SignJWT({ jti: "j-1", events: [ev(2, "person.upserted", person()), ev(1, "directory.upserted", {})] })
      .setProtectedHeader({ alg: "ES256", kid: "eklink-key-1", typ: over.typ ?? EVENTS_JWT_TYP })
      .setIssuer(over.iss ?? "https://eklink-test.example")
      .setAudience(over.aud ?? "approveit-client")
      .setIssuedAt()
      .setExpirationTime(over.exp ?? "5m")
      .sign(over.key ?? keys.privateKey);

  it("accepts a valid token and returns events in ascending id", async () => {
    setSyncEnv(true);
    const { events, jti } = await verifyEventsJwt(await sign(), jwks);
    expect(jti).toBe("j-1");
    expect(events.map((e) => e.id)).toEqual([1, 2]);
  });

  it("rejects wrong typ, audience, issuer, expired token and foreign key", async () => {
    setSyncEnv(true);
    await expect(verifyEventsJwt(await sign({ typ: "JWT" }), jwks)).rejects.toThrow("invalid_signature");
    await expect(verifyEventsJwt(await sign({ aud: "templateos" }), jwks)).rejects.toThrow("invalid_signature");
    await expect(verifyEventsJwt(await sign({ iss: "https://evil.example" }), jwks)).rejects.toThrow("invalid_signature");
    await expect(
      verifyEventsJwt(await sign({ exp: Math.floor(Date.now() / 1000) - 120 }), jwks)
    ).rejects.toThrow("invalid_signature");
    await expect(verifyEventsJwt(await sign({ key: otherKeys.privateKey }), jwks)).rejects.toThrow(
      "invalid_signature"
    );
    await expect(verifyEventsJwt("not.a.jwt", jwks)).rejects.toThrow("invalid_signature");
  });
});
