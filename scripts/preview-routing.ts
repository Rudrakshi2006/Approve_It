/**
 * Who would approve each request type, with the legacy routing and with EkLink
 * approver jobs, for one department. Read-only (same logic as the Settings preview).
 *
 *   npx tsx scripts/preview-routing.ts                 # SIU / SIT / CSE
 *   npx tsx scripts/preview-routing.ts SIU SIT CSE
 *   npx tsx scripts/preview-routing.ts SIU SIT STAFF --as S001   # chain as S001 would get it
 *
 * Exit code 1 if any non-"student picks" step finds nobody with EkLink jobs.
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { parseChain } from "../src/lib/workflow/chains";
import { resolveApprover } from "../src/lib/workflow/resolve-approver";
import {
  createEklinkResolutionContext,
  createLegacyResolutionContext,
  supabaseJobLookup,
} from "../src/lib/workflow/approver-source";
import { withoutSelfApproval } from "../src/lib/workflow/self-approval";

function loadEnv() {
  for (const f of [".env.local", ".env"]) {
    const p = path.resolve(process.cwd(), f);
    if (existsSync(p)) {
      try {
        process.loadEnvFile(p);
      } catch {
        // ignore unreadable env file
      }
    }
  }
}

async function main() {
  loadEnv();
  const argv = process.argv.slice(2);
  const asIndex = argv.indexOf("--as");
  const applicant = asIndex >= 0 ? (argv[asIndex + 1] || "").toUpperCase() : null;
  const positional = argv.filter((_, i) => asIndex < 0 || (i !== asIndex && i !== asIndex + 1));
  const [org = "SIU", inst = "SIT", dept = "CSE"] = positional.map((s) => s.toUpperCase());
  const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const placement = { org_code: org, institute_code: inst, department_code: dept };
  const legacy = createLegacyResolutionContext(db);
  const eklink = createEklinkResolutionContext(
    { ...supabaseJobLookup(db), placementOf: async () => placement },
    "__preview__"
  );

  const { data: types } = await db.from("application_types").select("key, name, chain").order("key");
  // Paged: a single select stops at 1,000 rows.
  const nameOf = new Map<string, string>();
  for (let from = 0; ; from += 1000) {
    const { data: page } = await db.from("people").select("login_id, name").range(from, from + 999);
    for (const p of page ?? []) nameOf.set(p.login_id as string, p.name as string);
    if (!page || page.length < 1000) break;
  }
  let missing = 0;

  console.log(`Placement ${org}/${inst}/${dept}\n`);
  for (const t of types ?? []) {
    console.log(`${t.key}  (${t.name})`);
    let chain = parseChain(t.chain);
    if (applicant) {
      const selfFree = await withoutSelfApproval(chain, applicant, (step) =>
        resolveApprover(
          step.resolver,
          { applicationType: t.key as string, stepKey: step.step_key, applicantDepartment: dept },
          eklink
        )
      );
      if (!selfFree.ok) {
        console.log(`   (as ${applicant}) ${selfFree.error}`);
        continue;
      }
      if (selfFree.skipped.length) console.log(`   (as ${applicant}) skipped own step(s): ${selfFree.skipped.join(", ")}`);
      chain = selfFree.chain;
    }
    for (const step of chain) {
      if (step.resolver.kind === "applicant_selected") {
        console.log(`   ${step.label.padEnd(32)} chosen by the applicant`);
        continue;
      }
      const run = async (ctx: typeof legacy) => {
        try {
          const id = await resolveApprover(
            step.resolver,
            { applicationType: t.key as string, stepKey: step.step_key, applicantDepartment: dept },
            ctx
          );
          return `${id} ${nameOf.get(id) ?? ""}`.trim();
        } catch (err) {
          return `NOT FOUND (${err instanceof Error ? err.message : "error"})`;
        }
      };
      const [l, e] = [await run(legacy), await run(eklink)];
      if (e.startsWith("NOT FOUND")) missing += 1;
      console.log(`   ${step.label.padEnd(32)} legacy: ${l.padEnd(42)} eklink: ${e}`);
    }
  }
  if (missing) {
    console.log(`\n${missing} step(s) find nobody with EkLink jobs.`);
    process.exit(1);
  }
  console.log("\nEvery step resolves with EkLink jobs.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
