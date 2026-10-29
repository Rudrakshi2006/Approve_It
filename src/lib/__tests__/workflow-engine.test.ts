import { describe, expect, it } from "vitest";
import {
  ApprovalChain,
  parseChain,
} from "../workflow/chains";
import {
  resolveApprover,
  type ApproverResolutionContext,
} from "../workflow/resolve-approver";
import {
  calculateTransition,
  type ApplicationState,
} from "../workflow/transitions";

describe("Workflow Engine: Chain Schema & Resolvers", () => {
  const sampleChain: ApprovalChain = [
    {
      step_key: "class_teacher",
      label: "Class Teacher",
      resolver: { kind: "applicant_selected" },
      can_reject: true,
      comment_required_on_reject: true,
      can_return: true,
    },
    {
      step_key: "hod",
      label: "HOD",
      resolver: { kind: "role_same_department", role: "hod" },
      can_reject: true,
      comment_required_on_reject: false,
      can_return: true,
    },
  ];

  it("parses and validates a valid approval chain", () => {
    const parsed = parseChain(sampleChain);
    expect(parsed.length).toBe(2);
    expect(parsed[0].step_key).toBe("class_teacher");
    expect(parsed[1].step_key).toBe("hod");
  });

  it("throws validation error for invalid resolver kind", () => {
    const invalid = [
      {
        step_key: "test",
        label: "Test",
        resolver: { kind: "unknown_resolver" },
      },
    ];
    expect(() => parseChain(invalid)).toThrow();
  });

  describe("Approver Resolution for ALL 5 Resolver Kinds", () => {
    const fakeContext: ApproverResolutionContext = {
      async findPersonsByRoleAndDept(role, dept) {
        if (role === "hod" && dept === "CSE") return ["HOD3001"];
        if (role === "hod" && dept === "MULTI") return ["HOD1", "HOD2"];
        return [];
      },
      async findPersonsByRole(role) {
        if (role === "director") return ["DIR4001"];
        if (role === "multi") return ["D1", "D2"];
        return [];
      },
      async findPersonsByAppRole(appRole) {
        if (appRole === "exam_cell") return ["STA5002"];
        if (appRole === "multi") return ["STA1", "STA2"];
        return [];
      },
      async findAssignedApprover(appType, stepKey) {
        if (appType === "hackathon" && stepKey === "incharge") return "FAC2001";
        return null;
      },
    };

    it("1. applicant_selected: resolves chosen login id", async () => {
      const result = await resolveApprover(
        { kind: "applicant_selected" },
        {
          applicationType: "medical",
          stepKey: "class_teacher",
          applicantDepartment: "CSE",
          selectedApproverLoginId: "FAC2002",
        },
        fakeContext
      );
      expect(result).toBe("FAC2002");
    });

    it("1. applicant_selected: throws if missing selection", async () => {
      await expect(
        resolveApprover(
          { kind: "applicant_selected" },
          {
            applicationType: "medical",
            stepKey: "class_teacher",
            applicantDepartment: "CSE",
            selectedApproverLoginId: null,
          },
          fakeContext
        )
      ).rejects.toThrow("No approver selected by applicant for this step");
    });

    it("2. role_same_department: resolves HOD in applicant's department", async () => {
      const result = await resolveApprover(
        { kind: "role_same_department", role: "hod" },
        {
          applicationType: "medical",
          stepKey: "hod",
          applicantDepartment: "CSE",
        },
        fakeContext
      );
      expect(result).toBe("HOD3001");
    });

    it("2. role_same_department: throws actionable error if zero HODs found", async () => {
      await expect(
        resolveApprover(
          { kind: "role_same_department", role: "hod" },
          {
            applicationType: "medical",
            stepKey: "hod",
            applicantDepartment: "MECH",
          },
          fakeContext
        )
      ).rejects.toThrow("No HOD configured for department MECH, contact admin");
    });

    it("2. role_same_department: throws error if multiple HODs found", async () => {
      await expect(
        resolveApprover(
          { kind: "role_same_department", role: "hod" },
          {
            applicationType: "medical",
            stepKey: "hod",
            applicantDepartment: "MULTI",
          },
          fakeContext
        )
      ).rejects.toThrow("Multiple people with role hod found for department MULTI, contact admin");
    });

    it("3. role: resolves global director role", async () => {
      const result = await resolveApprover(
        { kind: "role", role: "director" },
        {
          applicationType: "general",
          stepKey: "director",
          applicantDepartment: "CSE",
        },
        fakeContext
      );
      expect(result).toBe("DIR4001");
    });

    it("4. app_role: resolves designation from app_roles table", async () => {
      const result = await resolveApprover(
        { kind: "app_role", app_role: "exam_cell" },
        {
          applicationType: "re_ca",
          stepKey: "exam_cell",
          applicantDepartment: "CSE",
        },
        fakeContext
      );
      expect(result).toBe("STA5002");
    });

    it("5. assignment: resolves explicit approver assignment", async () => {
      const result = await resolveApprover(
        { kind: "assignment" },
        {
          applicationType: "hackathon",
          stepKey: "incharge",
          applicantDepartment: "CSE",
        },
        fakeContext
      );
      expect(result).toBe("FAC2001");
    });
  });

  describe("Application Transitions (Pure Decision Logic)", () => {
    const baseApp: ApplicationState = {
      id: "app-123",
      status: "in_review",
      current_step: 0,
      current_approver_login_id: "FAC2001",
    };

    it("approves intermediate step and advances to step 1", () => {
      const result = calculateTransition(
        baseApp,
        sampleChain,
        "FAC2001",
        "approve",
        "Looks valid"
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.new_status).toBe("in_review");
        expect(result.new_step).toBe(1);
        expect(result.needs_approver_resolution).toBe(true);
        expect(result.next_step_config?.step_key).toBe("hod");
      }
    });

    it("approves final step and marks status as approved", () => {
      const step1App: ApplicationState = {
        ...baseApp,
        current_step: 1,
        current_approver_login_id: "HOD3001",
      };

      const result = calculateTransition(
        step1App,
        sampleChain,
        "HOD3001",
        "approve"
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.new_status).toBe("approved");
        expect(result.new_step).toBe(1);
        expect(result.needs_approver_resolution).toBe(false);
      }
    });

    it("rejects with mandatory comment", () => {
      const result = calculateTransition(
        baseApp,
        sampleChain,
        "FAC2001",
        "reject",
        "Prescription dates do not match requested leave dates"
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.new_status).toBe("rejected");
        expect(result.decision).toBe("rejected");
      }
    });

    it("fails with 422 when rejecting without a comment", () => {
      const result = calculateTransition(
        baseApp,
        sampleChain,
        "FAC2001",
        "reject",
        "" // Empty comment
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.httpStatus).toBe(422);
        expect(result.code).toBe("COMMENT_REQUIRED_ON_REJECT");
      }
    });

    it("returns (hold) with comment", () => {
      const result = calculateTransition(
        baseApp,
        sampleChain,
        "FAC2001",
        "return",
        "Please attach doctor certificate with clinic seal"
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.new_status).toBe("returned");
        expect(result.decision).toBe("returned");
      }
    });

    it("fails with 422 when returning without comment", () => {
      const result = calculateTransition(
        baseApp,
        sampleChain,
        "FAC2001",
        "return",
        "   " // Whitespace only
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.httpStatus).toBe(422);
        expect(result.code).toBe("COMMENT_REQUIRED_ON_RETURN");
      }
    });

    it("fails with 403 when non-current approver attempts action", () => {
      const result = calculateTransition(
        baseApp,
        sampleChain,
        "DIFFERENT_TEACHER",
        "approve"
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.httpStatus).toBe(403);
        expect(result.code).toBe("ACTOR_NOT_CURRENT_APPROVER");
      }
    });

    it("fails with 409 when application is not in_review", () => {
      const approvedApp: ApplicationState = {
        ...baseApp,
        status: "approved",
      };

      const result = calculateTransition(
        approvedApp,
        sampleChain,
        "FAC2001",
        "approve"
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.httpStatus).toBe(409);
        expect(result.code).toBe("APPLICATION_NOT_IN_REVIEW");
      }
    });
  });
});
