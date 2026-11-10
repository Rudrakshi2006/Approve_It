import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSyncAdmin } from "@/lib/auth";
import { SESSION_COOKIE } from "@/lib/session";
import { getDb } from "@/lib/db";
import { parseChain } from "@/lib/workflow/chains";
import { resolveApprover } from "@/lib/workflow/resolve-approver";
import {
  APPROVER_SOURCE_KEY,
  createEklinkResolutionContext,
  createLegacyResolutionContext,
  normalizeSourceMap,
  supabaseJobLookup,
  type ApproverSource,
} from "@/lib/workflow/approver-source";

/**
 * GET  -> { sources: {type: source}, types: [{key,name}] }
 * GET ?preview=1&type=..&org=..&inst=..&dept=.. -> who each step would resolve to, per source
 * POST { type, source } -> switch one application type ('legacy' | 'eklink').
 * Switching only affects NEW applications (the source is pinned at submission).
 */

async function readMap(db: ReturnType<typeof getDb>): Promise<Record<string, ApproverSource>> {
  const { data } = await db
    .from("app_settings")
    .select("value")
    .eq("key", APPROVER_SOURCE_KEY)
    .maybeSingle();
  return normalizeSourceMap((data as { value?: unknown } | null)?.value);
}

export async function GET(request: NextRequest) {
  const auth = await requireApiSyncAdmin(request.cookies.get(SESSION_COOKIE)?.value);
  if (auth.errorResponse) return auth.errorResponse;
  const db = getDb();
  const sp = request.nextUrl.searchParams;

  if (!sp.get("preview")) {
    const [{ data: types }, sources] = await Promise.all([
      db.from("application_types").select("key, name").order("key"),
      readMap(db),
    ]);
    return NextResponse.json({ sources, types: types ?? [] });
  }

  const type = sp.get("type") || "";
  const dept = (sp.get("dept") || "").toUpperCase() || null;
  const placement = {
    org_code: (sp.get("org") || "").toUpperCase() || null,
    institute_code: (sp.get("inst") || "").toUpperCase() || null,
    department_code: dept,
  };

  const { data: typeRow } = await db
    .from("application_types")
    .select("key, chain")
    .eq("key", type)
    .maybeSingle();
  if (!typeRow) return NextResponse.json({ error: "Unknown application type" }, { status: 404 });

  let chain;
  try {
    chain = parseChain(typeRow.chain);
  } catch {
    return NextResponse.json({ error: "Chain configuration is invalid" }, { status: 422 });
  }

  const legacy = createLegacyResolutionContext(db);
  const baseLookup = supabaseJobLookup(db);
  const eklink = createEklinkResolutionContext(
    { ...baseLookup, placementOf: async () => placement },
    "__preview__"
  );

  const resolveWith = async (ctx: typeof legacy, step: (typeof chain)[number]) => {
    if (step.resolver.kind === "applicant_selected") {
      return { login_id: null, note: "Chosen by the applicant" };
    }
    try {
      const id = await resolveApprover(
        step.resolver,
        { applicationType: type, stepKey: step.step_key, applicantDepartment: dept || "" },
        ctx
      );
      return { login_id: id, note: null };
    } catch (err) {
      return { login_id: null, note: err instanceof Error ? err.message : "Not resolved" };
    }
  };

  const steps = [];
  for (const step of chain) {
    steps.push({
      step_key: step.step_key,
      label: step.label,
      kind: step.resolver.kind,
      legacy: await resolveWith(legacy, step),
      eklink: await resolveWith(eklink, step),
    });
  }

  const ids = steps.flatMap((s) => [s.legacy.login_id, s.eklink.login_id]).filter(Boolean) as string[];
  const names: Record<string, string> = {};
  if (ids.length > 0) {
    const { data } = await db.from("people").select("login_id, name").in("login_id", ids);
    for (const p of (data ?? []) as Array<{ login_id: string; name: string }>) names[p.login_id] = p.name;
  }

  return NextResponse.json({ type, placement, steps, names });
}

const UpdateSchema = z.object({
  type: z.string().min(1),
  source: z.enum(["legacy", "eklink"]),
});

export async function POST(request: NextRequest) {
  const auth = await requireApiSyncAdmin(request.cookies.get(SESSION_COOKIE)?.value);
  if (auth.errorResponse) return auth.errorResponse;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Validation failed" }, { status: 422 });
  }

  const db = getDb();
  const { data: typeRow } = await db
    .from("application_types")
    .select("key")
    .eq("key", parsed.data.type)
    .maybeSingle();
  if (!typeRow) return NextResponse.json({ error: "Unknown application type" }, { status: 404 });

  const map = await readMap(db);
  map[parsed.data.type] = parsed.data.source;
  const { error } = await db
    .from("app_settings")
    .upsert({ key: APPROVER_SOURCE_KEY, value: map, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, sources: map });
}
