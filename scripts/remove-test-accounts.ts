/**
 * Step 5b (SYNC_PLAN.md 4.5 C): remove ApproveIt's 15 ApproveIt-only test accounts.
 *
 *   npx tsx scripts/remove-test-accounts.ts            # dry run (default): counts + guard check only
 *   npx tsx scripts/remove-test-accounts.ts --apply    # backup, then delete in ONE transaction
 *
 * Requires migration 0006_eklink_sync.sql (is_test flags, approver_jobs and the
 * admin_remove_test_accounts() SQL function, which re-checks every guard inside the transaction).
 *
 * Refuses (exit 1) while:
 *   - any requested id is not flagged is_test,
 *   - any open application of a real user waits on a test account,
 *   - no current "Admin Staff" EkLink approver job (active, real person) exists,
 *   - any real user's application references a test account.
 * --apply first writes every linked row to backups/<date>/test-accounts/*.json (undo = restore).
 * Storage objects (attachment files, signatures) are not deleted; their paths are in the backup.
 * Secrets are never printed.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  BACKUP_TABLES,
  TEST_ACCOUNT_IDS,
  backupDir,
  evaluateRemovalGuards,
  parseArgs,
  type RemovalFacts,
} from "../src/lib/sync/test-accounts";

type Row = Record<string, unknown>;

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

function todayIST(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

async function select(
  db: SupabaseClient,
  table: string,
  build: (q: ReturnType<ReturnType<SupabaseClient["from"]>["select"]>) => PromiseLike<{ data: unknown; error: { message: string } | null }>
): Promise<Row[]> {
  const { data, error } = await build(db.from(table).select("*"));
  if (error) throw new Error(`${table}: ${error.message}`);
  return (data ?? []) as Row[];
}

/** Union of several filtered selects on one table, de-duplicated by `key`. */
async function union(
  db: SupabaseClient,
  table: string,
  key: string,
  filters: Array<{ column: string; values: string[] }>
): Promise<Row[]> {
  const out = new Map<string, Row>();
  for (const f of filters) {
    if (f.values.length === 0) continue;
    const rows = await select(db, table, (q) => q.in(f.column, f.values));
    for (const r of rows) out.set(String(r[key]), r);
  }
  return [...out.values()];
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(
      "Usage: npx tsx scripts/remove-test-accounts.ts [--apply] [--keep STA5001,...]   (dry run by default)\n" +
        "  --keep  test accounts to keep (deactivated, is_test) because real records point at them"
    );
    return;
  }

  loadEnv();
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    console.error("Missing SUPABASE_URL or SUPABASE_SECRET_KEY (looked in the environment, .env.local, .env).");
    process.exit(1);
  }
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const unknownKeep = args.keep.filter((id) => !TEST_ACCOUNT_IDS.includes(id as never));
  if (unknownKeep.length) {
    console.error(`--keep only accepts test accounts; not a test account: ${unknownKeep.join(", ")}`);
    process.exit(1);
  }
  const keep = args.keep;
  // Accounts to delete; kept ones are deactivated instead (their history stays linked).
  const ids = TEST_ACCOUNT_IDS.filter((id) => !keep.includes(id));
  if (keep.length) console.log(`Keeping (deactivate, not delete): ${keep.join(", ")}`);

  // ---- facts ---------------------------------------------------------------
  const people = await select(db, "people", (q) => q.in("login_id", ids));
  const flagged = new Set(people.filter((p) => p.is_test === true).map((p) => String(p.login_id)));
  const notFlaggedAsTest = ids.filter((id) => !flagged.has(id));

  const testApps = await select(db, "applications", (q) => q.in("applicant_login_id", ids));
  const testAppIds = new Set(testApps.map((a) => String(a.id)));

  const waiting = await select(db, "applications", (q) =>
    // Kept accounts are deactivated, so open requests waiting on them block too.
    q.in("status", ["in_review", "returned"]).in("current_approver_login_id", [...ids, ...keep])
  );
  const openWaitingOnTest = waiting
    .filter((a) => !testAppIds.has(String(a.id)))
    .map((a) => ({ id: String(a.id), subject: String(a.subject), approver: String(a.current_approver_login_id) }));

  const today = todayIST();
  const adminJobs = await select(db, "approver_jobs", (q) =>
    q.eq("title", "Admin Staff").lte("valid_from", today).or(`valid_to.is.null,valid_to.gte.${today}`)
  );
  const jobHolders = adminJobs.map((j) => j.person_login_id).filter(Boolean) as string[];
  const holders = jobHolders.length
    ? await select(db, "people", (q) => q.in("login_id", jobHolders))
    : [];
  const currentAdminStaffJobs = adminJobs.filter((j) => {
    const p = holders.find((h) => h.login_id === j.person_login_id);
    return p && p.is_active !== false && p.is_test !== true;
  }).length;

  const notTestApp = (r: Row) => !testAppIds.has(String(r.application_id));
  const realApps = (
    await union(db, "applications", "id", [
      { column: "class_teacher_login_id", values: ids },
      { column: "current_approver_login_id", values: ids },
    ])
  ).filter((a) => !testAppIds.has(String(a.id)));
  const realSteps = (await select(db, "application_steps", (q) => q.in("actor_login_id", ids))).filter(notTestApp);
  const realMsgs = (await select(db, "application_messages", (q) => q.in("author_login_id", ids))).filter(notTestApp);
  const realAtt = (await select(db, "attachments", (q) => q.in("uploaded_by", ids))).filter(notTestApp);
  const realLedger = (await select(db, "leave_ledger", (q) => q.in("login_id", ids))).filter(
    (l) => l.application_id && notTestApp(l)
  );
  const realRecordsReferencingTest =
    realApps.length + realSteps.length + realMsgs.length + realAtt.length + realLedger.length;

  const facts: RemovalFacts = {
    notFlaggedAsTest,
    openWaitingOnTest,
    currentAdminStaffJobs,
    realRecordsReferencingTest,
  };

  // ---- linked rows (counts / backup) -----------------------------------------
  const appIds = [...testAppIds];
  const linked: Record<string, Row[]> = {
    people,
    app_roles: await select(db, "app_roles", (q) => q.in("login_id", ids)),
    approver_assignments: await select(db, "approver_assignments", (q) => q.in("approver_login_id", ids)),
    approver_jobs: await select(db, "approver_jobs", (q) => q.in("person_login_id", ids)),
    applications: testApps,
    application_steps: await union(db, "application_steps", "id", [
      { column: "application_id", values: appIds },
      { column: "actor_login_id", values: ids },
    ]),
    application_messages: await union(db, "application_messages", "id", [
      { column: "application_id", values: appIds },
      { column: "author_login_id", values: ids },
    ]),
    attachments: await union(db, "attachments", "id", [
      { column: "application_id", values: appIds },
      { column: "uploaded_by", values: ids },
    ]),
    notifications: await union(db, "notifications", "id", [
      { column: "application_id", values: appIds },
      { column: "recipient_login_id", values: ids },
    ]),
    leave_ledger: await union(db, "leave_ledger", "id", [
      { column: "application_id", values: appIds },
      { column: "login_id", values: ids },
    ]),
  };

  console.log(args.apply ? "Mode: APPLY" : "Mode: dry run (pass --apply to delete)");
  console.log("Linked rows:");
  for (const t of BACKUP_TABLES) console.log(`  ${t.padEnd(22)} ${linked[t]?.length ?? 0}`);

  const guards = evaluateRemovalGuards(facts);
  if (!guards.ok) {
    console.error("\nRefusing:");
    for (const r of guards.reasons) console.error(`  - ${r}`);
    process.exit(1);
  }
  console.log("\nAll guards passed.");

  if (!args.apply) {
    console.log("Dry run only: nothing was written or deleted.");
    return;
  }

  // ---- backup ------------------------------------------------------------------
  const dir = backupDir(process.cwd());
  mkdirSync(dir, { recursive: true });
  for (const t of BACKUP_TABLES) {
    writeFileSync(path.join(dir, `${t}.json`), JSON.stringify(linked[t] ?? [], null, 2), "utf8");
  }
  writeFileSync(
    path.join(dir, "manifest.json"),
    JSON.stringify(
      {
        created_at: new Date().toISOString(),
        login_ids: ids,
        counts: Object.fromEntries(BACKUP_TABLES.map((t) => [t, linked[t]?.length ?? 0])),
        note: "Undo = re-insert these rows (people first, then applications, then the rest).",
      },
      null,
      2
    ),
    "utf8"
  );
  console.log(`Backup written to ${dir}`);

  // ---- delete in one transaction (SQL function re-checks every guard) ----------
  const { data, error } = await db.rpc("admin_remove_test_accounts", { p_login_ids: ids, p_apply: true });
  if (error) {
    console.error(`Deletion refused / failed, nothing deleted: ${error.message}`);
    process.exit(1);
  }
  console.log("Deleted:", JSON.stringify(data));

  // ---- post-check -----------------------------------------------------------------
  const left = await select(db, "people", (q) => q.in("login_id", ids));
  if (left.length > 0) {
    console.error(`Post-check failed: ${left.length} test account(s) still present.`);
    process.exit(1);
  }
  if (keep.length) {
    const { error: deactivateError } = await db
      .from("people")
      .update({ is_active: false, deactivated_at: new Date().toISOString() })
      .in("login_id", keep);
    if (deactivateError) {
      console.error(`Deleted the others, but could not deactivate kept accounts: ${deactivateError.message}`);
      process.exit(1);
    }
    console.log(`Deactivated (kept for history): ${keep.join(", ")}`);
  }
  console.log("Post-check: no removable test accounts left. Check every application type with Admin > App Settings > Preview.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
