import { describe, expect, it } from "vitest";
import type { ApprovalChain } from "../workflow/chains";
import { withoutSelfApproval } from "../workflow/self-approval";

const step = (step_key: string, kind = "role_same_department") =>
  ({
    label: step_key,
    step_key,
    resolver: kind === "applicant_selected" ? { kind } : { kind, role: step_key },
    can_reject: true,
    can_return: true,
  }) as unknown as ApprovalChain[number];

const chain = [step("hod"), step("director", "role")] as ApprovalChain;
const who: Record<string, string> = { hod: "S001", director: "T001" };
const resolve = async (s: ApprovalChain[number]) => who[s.step_key];

describe("withoutSelfApproval", () => {
  it("drops the step where the applicant would approve themselves", async () => {
    const r = await withoutSelfApproval(chain, "S001", resolve);
    expect(r.ok && r.chain.map((s) => s.step_key)).toEqual(["director"]);
    expect(r.ok && r.skipped).toEqual(["hod"]);
  });

  it("keeps the full chain for everyone else", async () => {
    const r = await withoutSelfApproval(chain, "S020", resolve);
    expect(r.ok && r.chain.map((s) => s.step_key)).toEqual(["hod", "director"]);
  });

  it("keeps steps the applicant chooses and steps that cannot be resolved yet", async () => {
    const withPick = [step("class_teacher", "applicant_selected"), step("hod")] as ApprovalChain;
    const failing = async () => {
      throw new Error("contact admin");
    };
    const r = await withoutSelfApproval(withPick, "S001", failing);
    expect(r.ok && r.chain.map((s) => s.step_key)).toEqual(["class_teacher", "hod"]);
  });

  it("refuses a request that only the applicant could approve", async () => {
    const r = await withoutSelfApproval([step("director", "role")] as ApprovalChain, "T001", resolve);
    expect(r.ok).toBe(false);
  });
});
