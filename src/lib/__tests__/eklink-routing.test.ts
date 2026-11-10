import { describe, expect, it } from "vitest";
import {
  contextForSource,
  createEklinkResolutionContext,
  normalizeSourceMap,
  pinApproverSource,
  pinnedApproverSource,
  selectJobs,
  type ApproverJob,
  type JobLookup,
  type Placement,
  withoutInactive,
} from "../workflow/approver-source";
import { resolveApprover, type ApproverResolutionContext } from "../workflow/resolve-approver";
import { parseChain } from "../workflow/chains";
import {
  TEST_ACCOUNT_IDS,
  backupDir,
  evaluateRemovalGuards,
  parseArgs,
} from "../sync/test-accounts";
import type { SupabaseClient } from "@supabase/supabase-js";

const TODAY = "2026-11-09";

function job(over: Partial<ApproverJob>): ApproverJob {
  return {
    eklink_id: Math.random().toString(36).slice(2),
    person_login_id: null,
    person_sub: null,
    title: "HOD",
    scope_level: "department",
    org_code: "SIU",
    institute_code: "SIT",
    department_code: "CSE",
    scope_key: null,
    valid_from: "2026-01-01",
    valid_to: null,
    ...over,
  };
}

const JOBS: ApproverJob[] = [
  job({ person_login_id: "T004", title: "HOD", department_code: "CSE" }),
  job({ person_login_id: "T050", title: "HOD", department_code: "ECE" }),
  job({ person_login_id: "T090", title: "HOD", department_code: "CSE", valid_to: "2026-06-30" }), // ended (former HOD)
  job({ person_login_id: "T001", title: "Director", scope_level: "institute", department_code: null }),
  job({ person_login_id: "T009", title: "Exam Cell", scope_level: "institute", department_code: null }),
  job({ person_login_id: "T036", title: "Event In-charge", scope_key: "hackathon" }),
  job({ person_login_id: "T777", title: "Admin Staff", scope_level: "institute", department_code: null, valid_from: "2027-01-01" }), // upcoming
];

function lookup(
  jobs: ApproverJob[],
  placement: Placement | null,
  inactive: string[] = []
): JobLookup {
  return {
    async jobsByTitle(title) {
      return jobs.filter((j) => j.title === title);
    },
    async activeLoginIds(js) {
      return js.map((j) => j.person_login_id!).filter((id) => id && !inactive.includes(id));
    },
    async placementOf() {
      return placement;
    },
  };
}

const CSE_STUDENT: Placement = { org_code: "SIU", institute_code: "SIT", department_code: "CSE" };

describe("Approver source: EkLink job lookups behind the existing resolver kinds", () => {
  const ctx = createEklinkResolutionContext(lookup(JOBS, CSE_STUDENT), "24070521003", { today: TODAY });
  const target = { applicationType: "hackathon", stepKey: "x", applicantDepartment: "CSE" };

  it("role_same_department hod -> current HOD job of the applicant's department (ended jobs ignored)", async () => {
    const id = await resolveApprover({ kind: "role_same_department", role: "hod" }, target, ctx);
    expect(id).toBe("T004");
  });

  it("role director -> Director job of the applicant's institute", async () => {
    expect(await resolveApprover({ kind: "role", role: "director" }, target, ctx)).toBe("T001");
  });

  it("app_role exam_cell -> Exam Cell job", async () => {
    expect(await resolveApprover({ kind: "app_role", app_role: "exam_cell" }, target, ctx)).toBe("T009");
  });

  it("app_role admin_staff with only an upcoming job -> friendly contact-admin error (no fallback)", async () => {
    await expect(
      resolveApprover({ kind: "app_role", app_role: "admin_staff" }, target, ctx)
    ).rejects.toThrow(/contact admin/);
  });

  it("assignment -> Event In-charge job whose scope_key matches the application type", async () => {
    expect(
      await resolveApprover({ kind: "assignment", scope_key: null }, { ...target, stepKey: "hackathon_incharge" }, ctx)
    ).toBe("T036");
    await expect(
      resolveApprover({ kind: "assignment" }, { ...target, applicationType: "general" }, ctx)
    ).rejects.toThrow(/No approver assignment configured/);
  });

  it("applicant_selected is unchanged", async () => {
    expect(
      await resolveApprover({ kind: "applicant_selected" }, { ...target, selectedApproverLoginId: "T017" }, ctx)
    ).toBe("T017");
  });

  it("a deactivated job holder is never resolved (contact admin instead)", async () => {
    const c = createEklinkResolutionContext(lookup(JOBS, CSE_STUDENT, ["T004"]), "x", { today: TODAY });
    await expect(
      resolveApprover({ kind: "role_same_department", role: "hod" }, target, c)
    ).rejects.toThrow(/No HOD configured for department CSE, contact admin/);
  });

  it("uses the applicant's department codes; falls back to the department text when codes are unknown", async () => {
    const ece = createEklinkResolutionContext(
      lookup(JOBS, { org_code: "SIU", institute_code: "SIT", department_code: "ECE" }),
      "x",
      { today: TODAY }
    );
    expect(await resolveApprover({ kind: "role_same_department", role: "hod" }, target, ece)).toBe("T050");

    const unknown = createEklinkResolutionContext(lookup(JOBS, null), "x", { today: TODAY });
    expect(
      await resolveApprover({ kind: "role_same_department", role: "hod" }, { ...target, applicantDepartment: "ECE" }, unknown)
    ).toBe("T050");
  });

  it("two current HOD jobs for one department -> multiple-approvers error", async () => {
    const c = createEklinkResolutionContext(
      lookup([...JOBS, job({ person_login_id: "T005", title: "HOD" })], CSE_STUDENT),
      "x",
      { today: TODAY }
    );
    await expect(resolveApprover({ kind: "role_same_department", role: "hod" }, target, c)).rejects.toThrow(
      /Multiple/
    );
  });

  it("selectJobs prefers the most specific covering scope", () => {
    const jobs = [
      job({ title: "Exam Cell", scope_level: "organization", institute_code: null, department_code: null, person_login_id: "ORG" }),
      job({ title: "Exam Cell", scope_level: "institute", department_code: null, person_login_id: "INST" }),
      job({ title: "Exam Cell", scope_level: "institute", institute_code: "OTHER", department_code: null, person_login_id: "X" }),
    ];
    const chosen = selectJobs(jobs, { title: "Exam Cell", placement: CSE_STUDENT, today: TODAY });
    expect(chosen.map((j) => j.person_login_id)).toEqual(["INST"]);
  });
});

describe("Approver source switch", () => {
  const legacy: ApproverResolutionContext = {
    findPersonsByRoleAndDept: async () => ["LEGACY_HOD"],
    findPersonsByRole: async () => ["LEGACY_DIR"],
    findPersonsByAppRole: async () => ["LEGACY_ROLE"],
    findAssignedApprover: async () => "LEGACY_ASSIGNED",
  };

  it("legacy source keeps the caller's lookups (unchanged when the people lookup is unavailable)", async () => {
    const ctx = contextForSource("legacy", legacy, {} as SupabaseClient, "x");
    const target = { applicationType: "medical", stepKey: "hod", applicantDepartment: "CSE" };
    expect(await resolveApprover({ kind: "role_same_department", role: "hod" }, target, ctx)).toBe("LEGACY_HOD");
    expect(await resolveApprover({ kind: "assignment" }, target, ctx)).toBe("LEGACY_ASSIGNED");
  });

  it("legacy routing skips people deactivated in EkLink (contact admin, no silent fallback)", async () => {
    const ctx = withoutInactive(legacy, async (ids) => ids.filter((id) => id !== "LEGACY_HOD"));
    const target = { applicationType: "medical", stepKey: "hod", applicantDepartment: "CSE" };
    await expect(
      resolveApprover({ kind: "role_same_department", role: "hod" }, target, ctx)
    ).rejects.toThrow(/contact admin/);
    expect(await resolveApprover({ kind: "role", role: "director" }, target, ctx)).toBe("LEGACY_DIR");
  });

  it("eklink source returns a different (job-based) context", () => {
    expect(contextForSource("eklink", legacy, {} as SupabaseClient, "x")).not.toBe(legacy);
  });

  it("settings map defaults to legacy for anything that is not exactly 'eklink'", () => {
    expect(normalizeSourceMap({ medical: "eklink", hackathon: "EKLINK", general: 1 })).toEqual({
      medical: "eklink",
      hackathon: "legacy",
      general: "legacy",
    });
    expect(normalizeSourceMap(null)).toEqual({});
  });

  it("the source is pinned in the chain snapshot; old snapshots count as legacy", () => {
    const chain = parseChain([
      { step_key: "hod", label: "HOD", resolver: { kind: "role_same_department", role: "hod" } },
      { step_key: "director", label: "Director", resolver: { kind: "role", role: "director" } },
    ]);
    expect(pinnedApproverSource(chain)).toBe("legacy");
    const pinned = pinApproverSource(chain, "eklink");
    expect(pinnedApproverSource(pinned)).toBe("eklink");
    // survives a DB round trip + re-parse
    expect(pinnedApproverSource(parseChain(JSON.parse(JSON.stringify(pinned))))).toBe("eklink");
  });
});

describe("remove-test-accounts guards (step 5b)", () => {
  const ok = {
    notFlaggedAsTest: [],
    openWaitingOnTest: [],
    currentAdminStaffJobs: 1,
    realRecordsReferencingTest: 0,
  };

  it("lists exactly the 15 ApproveIt-only test accounts", () => {
    expect(TEST_ACCOUNT_IDS).toHaveLength(15);
    expect(TEST_ACCOUNT_IDS).toContain("STA5001");
    expect(TEST_ACCOUNT_IDS.every((id) => /^(STU|FAC|STA|HOD|DIR)\d{4}$/.test(id))).toBe(true);
  });

  it("passes when every guard is satisfied", () => {
    expect(evaluateRemovalGuards(ok)).toEqual({ ok: true, reasons: [] });
  });

  it("refuses while a real open application waits on a test account", () => {
    const r = evaluateRemovalGuards({
      ...ok,
      openWaitingOnTest: [{ id: "a1", subject: "Hackathon NOC", approver: "STA5001" }],
    });
    expect(r.ok).toBe(false);
    expect(r.reasons[0]).toMatch(/wait on a test account/);
  });

  it("refuses while no current Admin Staff EkLink job exists", () => {
    const r = evaluateRemovalGuards({ ...ok, currentAdminStaffJobs: 0 });
    expect(r.ok).toBe(false);
    expect(r.reasons[0]).toMatch(/Admin Staff/);
  });

  it("refuses when ids are not flagged is_test or real records reference them", () => {
    const r = evaluateRemovalGuards({ ...ok, notFlaggedAsTest: ["T004"], realRecordsReferencingTest: 3 });
    expect(r.ok).toBe(false);
    expect(r.reasons).toHaveLength(2);
  });

  it("is a dry run unless --apply is passed; backups go to backups/<date>/test-accounts", () => {
    expect(parseArgs([]).apply).toBe(false);
    expect(parseArgs(["--yes"]).apply).toBe(false);
    expect(parseArgs(["--apply"]).apply).toBe(true);
    expect(parseArgs([]).keep).toEqual([]);
    expect(parseArgs(["--apply", "--keep", "sta5001"]).keep).toEqual(["STA5001"]);
    expect(parseArgs(["--keep=STA5001,FAC2003", "--keep", "STA5001"]).keep).toEqual([
      "STA5001",
      "FAC2003",
    ]);
    expect(backupDir("/repo/ApproveIt/", new Date(2026, 10, 9))).toBe(
      "/repo/ApproveIt/backups/2026-11-09/test-accounts"
    );
  });
});
