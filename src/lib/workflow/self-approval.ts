import type { ApprovalChain } from "./chains";

type Step = ApprovalChain[number];

/**
 * Nobody approves their own request. At submission, every step whose approver
 * would be the applicant (e.g. the SIT Staff head applying for leave, whose first
 * step "HOD of SIT Staff" is himself) is dropped from THIS application's chain
 * snapshot, so it starts at the next real approver (the Director).
 *
 * - Steps the applicant chooses ("applicant_selected") are always kept.
 * - A step that cannot be resolved now is kept: it fails at its own turn with the
 *   usual "contact admin" message, exactly as before.
 * - If every step would be the applicant, an error is returned instead.
 */
export async function withoutSelfApproval(
  chain: ApprovalChain,
  applicantLoginId: string,
  resolve: (step: Step) => Promise<string>
): Promise<{ ok: true; chain: ApprovalChain; skipped: string[] } | { ok: false; error: string }> {
  const kept: Step[] = [];
  const skipped: string[] = [];
  for (const step of chain) {
    if (step.resolver.kind === "applicant_selected") {
      kept.push(step);
      continue;
    }
    let approver: string | null = null;
    try {
      approver = await resolve(step);
    } catch {
      approver = null;
    }
    if (approver && approver.toUpperCase() === applicantLoginId.toUpperCase()) {
      skipped.push(step.step_key);
      continue;
    }
    kept.push(step);
  }
  if (kept.length === 0) {
    return {
      ok: false,
      error: "This request would only be approved by you. Contact admin to set up another approver.",
    };
  }
  return { ok: true, chain: kept as ApprovalChain, skipped };
}
