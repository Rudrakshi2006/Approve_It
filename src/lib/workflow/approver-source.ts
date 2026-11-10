import type { SupabaseClient } from "@supabase/supabase-js";
import { getTodayIST } from "../date";
import {
  ApproverResolutionError,
  type ApproverResolutionContext,
} from "./resolve-approver";
import type { ApprovalChain } from "./chains";

/**
 * Approver source switch (SYNC_PLAN.md 4.4 C).
 *
 * app_settings.approver_source = { "<application type>": "legacy" | "eklink" } (default legacy).
 * The chosen source is pinned into the application's chain_snapshot at submission, so
 * applications already in flight are never re-routed when the switch changes.
 *
 * "eklink" keeps the 5 resolver kinds but looks them up in approver_jobs (EkLink mirror):
 *   role_same_department hod      -> current "HOD" job of the applicant's department
 *   role director                 -> current "Director" job of the applicant's institute
 *   app_role exam_cell/admin_staff-> current "Exam Cell" / "Admin Staff" job
 *   assignment                    -> current "Event In-charge" job with matching scope_key
 *   applicant_selected            -> unchanged
 * If nobody is found the resolver raises its usual "contact admin" error (no silent fallback).
 */

export type ApproverSource = "legacy" | "eklink";
export const APPROVER_SOURCE_KEY = "approver_source";

export function normalizeSourceMap(raw: unknown): Record<string, ApproverSource> {
  const out: Record<string, ApproverSource> = {};
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      out[k] = v === "eklink" ? "eklink" : "legacy";
    }
  }
  return out;
}

export async function getApproverSource(
  db: SupabaseClient,
  applicationType: string
): Promise<ApproverSource> {
  try {
    const { data, error } = await db
      .from("app_settings")
      .select("value")
      .eq("key", APPROVER_SOURCE_KEY)
      .maybeSingle();
    if (error || !data) return "legacy";
    return normalizeSourceMap((data as { value: unknown }).value)[applicationType] ?? "legacy";
  } catch {
    return "legacy";
  }
}

/** Stamps the source on every step of the chain snapshot stored with the application. */
export function pinApproverSource(chain: ApprovalChain, source: ApproverSource): ApprovalChain {
  return chain.map((step) => ({ ...step, approver_source: source }));
}

/** Source pinned at submission (applications created before the switch existed -> legacy). */
export function pinnedApproverSource(chain: ApprovalChain | null | undefined): ApproverSource {
  const step = (chain ?? []).find((s) => s && (s as { approver_source?: string }).approver_source);
  return (step as { approver_source?: string } | undefined)?.approver_source === "eklink"
    ? "eklink"
    : "legacy";
}

// ---------------------------------------------------------------------------
// Job matching (pure)
// ---------------------------------------------------------------------------

export type ApproverJob = {
  eklink_id: string;
  person_login_id: string | null;
  person_sub: string | null;
  title: string;
  scope_level: "organization" | "institute" | "department" | string;
  org_code: string | null;
  institute_code: string | null;
  department_code: string | null;
  scope_key: string | null;
  valid_from: string;
  valid_to: string | null;
};

export type Placement = {
  org_code: string | null;
  institute_code: string | null;
  department_code: string | null;
};

export const ROLE_TO_TITLE: Record<string, string> = {
  hod: "HOD",
  director: "Director",
  dean: "Dean",
};

export const APP_ROLE_TO_TITLE: Record<string, string> = {
  exam_cell: "Exam Cell",
  admin_staff: "Admin Staff",
};

export const ASSIGNMENT_TITLE = "Event In-charge";

const LEVEL_RANK: Record<string, number> = { organization: 1, institute: 2, department: 3 };

export function isCurrentJob(job: Pick<ApproverJob, "valid_from" | "valid_to">, today: string): boolean {
  const from = (job.valid_from ?? "").slice(0, 10);
  const to = job.valid_to ? job.valid_to.slice(0, 10) : null;
  return from <= today && (to === null || to >= today);
}

function eq(a: string | null | undefined, b: string | null | undefined): boolean {
  // Unknown on the applicant side is treated as "matches" (codes not resolved yet).
  if (!b) return true;
  if (!a) return false;
  return a.toUpperCase() === b.toUpperCase();
}

/** Does the job's scope contain the applicant's placement? */
export function jobCovers(job: ApproverJob, p: Placement): boolean {
  switch (job.scope_level) {
    case "organization":
      return eq(job.org_code, p.org_code);
    case "institute":
      return eq(job.org_code, p.org_code) && eq(job.institute_code, p.institute_code);
    case "department":
      return (
        eq(job.org_code, p.org_code) &&
        eq(job.institute_code, p.institute_code) &&
        eq(job.department_code, p.department_code)
      );
    default:
      return false;
  }
}

/**
 * Current jobs with `title` covering the placement; only the most specific scope level wins
 * (a department-level job beats an institute-level one). Several at that level -> all returned
 * (the resolver then reports "multiple ... contact admin").
 */
export function selectJobs(
  jobs: ApproverJob[],
  opts: {
    title: string;
    placement: Placement;
    today: string;
    levels?: string[];
    scopeKey?: string | null;
  }
): ApproverJob[] {
  const title = opts.title.toLowerCase();
  const key = opts.scopeKey ? opts.scopeKey.toLowerCase() : null;
  const matches = jobs.filter(
    (j) =>
      j.title.toLowerCase() === title &&
      isCurrentJob(j, opts.today) &&
      (!opts.levels || opts.levels.includes(j.scope_level)) &&
      (key === null || (j.scope_key ?? "").toLowerCase() === key) &&
      jobCovers(j, opts.placement)
  );
  if (matches.length === 0) return [];
  const best = Math.max(...matches.map((j) => LEVEL_RANK[j.scope_level] ?? 0));
  return matches.filter((j) => (LEVEL_RANK[j.scope_level] ?? 0) === best);
}

// ---------------------------------------------------------------------------
// EkLink-job resolution context
// ---------------------------------------------------------------------------

export type JobLookup = {
  /** Current jobs of a title (DB filter by title; current/scope filtering is done in memory). */
  jobsByTitle(title: string): Promise<ApproverJob[]>;
  /** login_ids of jobs -> only active people (resolves person_sub when login_id is missing). */
  activeLoginIds(jobs: ApproverJob[]): Promise<string[]>;
  placementOf(loginId: string): Promise<Placement | null>;
};

export function supabaseJobLookup(db: SupabaseClient): JobLookup {
  return {
    async jobsByTitle(title) {
      const { data, error } = await db.from("approver_jobs").select("*").eq("title", title);
      if (error) {
        throw new ApproverResolutionError(
          "EkLink approver jobs are not available yet, contact admin",
          "EKLINK_JOBS_UNAVAILABLE"
        );
      }
      return (data ?? []) as ApproverJob[];
    },
    async activeLoginIds(jobs) {
      const ids = new Set<string>();
      const subs: string[] = [];
      for (const j of jobs) {
        if (j.person_login_id) ids.add(j.person_login_id);
        else if (j.person_sub) subs.push(j.person_sub);
      }
      const out = new Set<string>();
      if (ids.size > 0) {
        const { data } = await db
          .from("people")
          .select("login_id, is_active")
          .in("login_id", [...ids]);
        for (const r of (data ?? []) as Array<{ login_id: string; is_active: boolean | null }>) {
          if (r.is_active !== false) out.add(r.login_id);
        }
      }
      if (subs.length > 0) {
        const { data } = await db
          .from("people")
          .select("login_id, is_active")
          .in("eklink_sub", subs);
        for (const r of (data ?? []) as Array<{ login_id: string; is_active: boolean | null }>) {
          if (r.is_active !== false) out.add(r.login_id);
        }
      }
      return [...out];
    },
    async placementOf(loginId) {
      const { data, error } = await db
        .from("people")
        .select("org_code, institute_code, department_code, department")
        .eq("login_id", loginId)
        .maybeSingle();
      if (error || !data) return null;
      const d = data as Placement & { department: string | null };
      return {
        org_code: d.org_code ?? null,
        institute_code: d.institute_code ?? null,
        department_code: d.department_code ?? (d.department ? d.department.toUpperCase() : null),
      };
    },
  };
}

export function createEklinkResolutionContext(
  lookup: JobLookup,
  applicantLoginId: string,
  opts: { today?: string; fallbackDepartment?: string | null } = {}
): ApproverResolutionContext {
  const today = opts.today ?? getTodayIST();
  let placementPromise: Promise<Placement> | null = null;

  const placement = (department?: string | null): Promise<Placement> => {
    if (!placementPromise) {
      placementPromise = lookup.placementOf(applicantLoginId).then((p) => ({
        org_code: p?.org_code ?? null,
        institute_code: p?.institute_code ?? null,
        department_code:
          p?.department_code ??
          (opts.fallbackDepartment ? opts.fallbackDepartment.toUpperCase() : null),
      }));
    }
    return placementPromise.then((p) => ({
      ...p,
      department_code: p.department_code ?? (department ? department.toUpperCase() : null),
    }));
  };

  const resolve = async (title: string, sel: { levels?: string[]; scopeKey?: string | null; department?: string | null }) => {
    const jobs = await lookup.jobsByTitle(title);
    const chosen = selectJobs(jobs, {
      title,
      placement: await placement(sel.department),
      today,
      levels: sel.levels,
      scopeKey: sel.scopeKey,
    });
    return lookup.activeLoginIds(chosen);
  };

  return {
    async findPersonsByRoleAndDept(role, department) {
      const title = ROLE_TO_TITLE[role.toLowerCase()];
      if (!title) return [];
      return resolve(title, { levels: ["department"], department });
    },
    async findPersonsByRole(role) {
      const title = ROLE_TO_TITLE[role.toLowerCase()];
      if (!title) return [];
      return resolve(title, {
        levels: title === "HOD" ? ["department"] : ["institute", "organization"],
      });
    },
    async findPersonsByAppRole(appRole) {
      const title = APP_ROLE_TO_TITLE[appRole.toLowerCase()];
      if (!title) return [];
      return resolve(title, {});
    },
    async findAssignedApprover(appType, _stepKey, scopeKey) {
      const ids = await resolve(ASSIGNMENT_TITLE, { scopeKey: scopeKey || appType });
      if (ids.length > 1) {
        throw new ApproverResolutionError(
          `Multiple ${ASSIGNMENT_TITLE} jobs found for ${scopeKey || appType}, contact admin`,
          "MULTIPLE_ASSIGNED_APPROVERS"
        );
      }
      return ids[0] ?? null;
    },
  };
}

/** Keeps only active people (people.is_active); fails open when the lookup is unavailable. */
export type ActiveFilter = (loginIds: string[]) => Promise<string[]>;

export function supabaseActiveFilter(db: SupabaseClient): ActiveFilter {
  return async (ids) => {
    if (ids.length === 0) return ids;
    try {
      const { data, error } = await db.from("people").select("login_id, is_active").in("login_id", ids);
      if (error || !data) return ids; // before migration 0006: unchanged behaviour
      const inactive = new Set(
        (data as Array<{ login_id: string; is_active: boolean | null }>)
          .filter((r) => r.is_active === false)
          .map((r) => r.login_id)
      );
      return ids.filter((id) => !inactive.has(id));
    } catch {
      return ids;
    }
  };
}

/**
 * Wraps the caller's legacy context so people deactivated in EkLink are never picked for
 * new routing (the resolver then reports its usual "contact admin" error).
 */
export function withoutInactive(
  ctx: ApproverResolutionContext,
  keepActive: ActiveFilter
): ApproverResolutionContext {
  return {
    findPersonsByRoleAndDept: async (role, department) =>
      keepActive(await ctx.findPersonsByRoleAndDept(role, department)),
    findPersonsByRole: async (role) => keepActive(await ctx.findPersonsByRole(role)),
    findPersonsByAppRole: async (appRole) => keepActive(await ctx.findPersonsByAppRole(appRole)),
    findAssignedApprover: async (appType, stepKey, scopeKey) => {
      const id = await ctx.findAssignedApprover(appType, stepKey, scopeKey);
      if (!id) return null;
      return (await keepActive([id]))[0] ?? null;
    },
  };
}

/** Picks the context for a source: legacy keeps the caller's lookups (minus deactivated people). */
export function contextForSource(
  source: ApproverSource,
  legacy: ApproverResolutionContext,
  db: SupabaseClient,
  applicantLoginId: string,
  fallbackDepartment?: string | null
): ApproverResolutionContext {
  if (source !== "eklink") return withoutInactive(legacy, supabaseActiveFilter(db));
  return createEklinkResolutionContext(supabaseJobLookup(db), applicantLoginId, {
    fallbackDepartment,
  });
}

/**
 * Legacy lookups as used at submission (people.eklink_role + department text, app_roles,
 * approver_assignments). Used by the admin preview; the request handlers keep their own copies.
 */
export function createLegacyResolutionContext(db: SupabaseClient): ApproverResolutionContext {
  return {
    async findPersonsByRoleAndDept(role, department) {
      const { data } = await db
        .from("people")
        .select("login_id")
        .eq("eklink_role", role)
        .eq("department", department);
      return (data || []).map((r: { login_id: string }) => r.login_id);
    },
    async findPersonsByRole(role) {
      const { data } = await db.from("people").select("login_id").eq("eklink_role", role);
      return (data || []).map((r: { login_id: string }) => r.login_id);
    },
    async findPersonsByAppRole(appRole) {
      const { data } = await db.from("app_roles").select("login_id").eq("app_role", appRole);
      return (data || []).map((r: { login_id: string }) => r.login_id);
    },
    async findAssignedApprover(appType, stepKey, scopeKey) {
      let query = db
        .from("approver_assignments")
        .select("approver_login_id")
        .eq("application_type", appType)
        .eq("step_key", stepKey);
      if (scopeKey) query = query.eq("scope_key", scopeKey);
      const { data } = await query.maybeSingle();
      return data?.approver_login_id ?? null;
    },
  };
}
