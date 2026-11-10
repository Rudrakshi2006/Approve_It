/**
 * Step 5b (SYNC_PLAN.md 4.5 C): removal of ApproveIt's 15 ApproveIt-only test accounts.
 * Pure helpers shared by scripts/remove-test-accounts.ts and its tests (no server-only import).
 */

export const TEST_ACCOUNT_IDS = [
  "STU1001",
  "STU1002",
  "STU1003",
  "STU1004",
  "STU1005",
  "FAC2001",
  "FAC2002",
  "FAC2003",
  "FAC2004",
  "FAC2005",
  "FAC2006",
  "STA5001",
  "STA5002",
  "HOD3001",
  "DIR4001",
] as const;

/** Tables backed up before deletion (everything linked to the test accounts). */
export const BACKUP_TABLES = [
  "people",
  "app_roles",
  "approver_assignments",
  "approver_jobs",
  "applications",
  "application_steps",
  "application_messages",
  "attachments",
  "notifications",
  "leave_ledger",
] as const;

export type RemovalFacts = {
  /** Requested ids that are missing or not flagged is_test. */
  notFlaggedAsTest: string[];
  /** Open (in_review / returned) applications of real users whose current approver is a test account. */
  openWaitingOnTest: Array<{ id: string; subject: string; approver: string }>;
  /** Current "Admin Staff" EkLink jobs held by an active, non-test person. */
  currentAdminStaffJobs: number;
  /** Rows of real users' applications (class teacher, steps, messages, attachments) that reference a test account. */
  realRecordsReferencingTest: number;
};

export function evaluateRemovalGuards(f: RemovalFacts): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (f.notFlaggedAsTest.length > 0) {
    reasons.push(`Not flagged as test accounts (or missing): ${f.notFlaggedAsTest.join(", ")}`);
  }
  if (f.openWaitingOnTest.length > 0) {
    reasons.push(
      `${f.openWaitingOnTest.length} open application(s) of real users wait on a test account: ` +
        f.openWaitingOnTest.map((a) => `${a.id} "${a.subject}" -> ${a.approver}`).join("; ") +
        ". Reassign them first (Admin > EkLink Sync)."
    );
  }
  if (f.currentAdminStaffJobs < 1) {
    reasons.push(
      "No current Admin Staff approver job in EkLink (held by an active, real person). " +
        "The Hackathon NOC chain starts with Admin Staff: assign one in EkLink and sync first."
    );
  }
  if (f.realRecordsReferencingTest > 0) {
    reasons.push(
      `${f.realRecordsReferencingTest} record(s) of real users' applications reference a test account ` +
        "(class teacher / approval step / message / attachment). They would be lost; resolve them first."
    );
  }
  return { ok: reasons.length === 0, reasons };
}

export function backupDir(root: string, now: Date = new Date()): string {
  const day = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return `${root.replace(/[\\/]+$/, "")}/backups/${day}/test-accounts`;
}

export type ParsedArgs = { apply: boolean; help: boolean; keep: string[] };

/**
 * --keep STA5001[,X] (or --keep=STA5001): test accounts that are NOT deleted but
 * deactivated instead, because real records (e.g. approval history) point at them.
 */
export function parseArgs(argv: string[]): ParsedArgs {
  const keep: string[] = [];
  argv.forEach((arg, index) => {
    let value: string | undefined;
    if (arg === "--keep") value = argv[index + 1];
    else if (arg.startsWith("--keep=")) value = arg.slice("--keep=".length);
    if (value) {
      for (const id of value.split(",")) {
        const clean = id.trim().toUpperCase();
        if (clean) keep.push(clean);
      }
    }
  });
  return {
    apply: argv.includes("--apply"),
    help: argv.includes("--help") || argv.includes("-h"),
    keep: [...new Set(keep)],
  };
}
