import { describe, expect, it } from "vitest";
import { parseChain, type ApprovalChain } from "../workflow/chains";
import {
  resolveApprover,
  type ApproverResolutionContext,
  ApproverResolutionError,
} from "../workflow/resolve-approver";
import {
  calculateTransition,
  type ApplicationState,
} from "../workflow/transitions";
import { parseAndValidateCsv } from "@/lib/people/csv-import";

describe("Phase 4: Multi-Workflow Chains & Dynamic Resolvers", () => {
  const hackathonChain: ApprovalChain = [
    {
      step_key: "admin_staff",
      label: "Administration Staff",
      resolver: { kind: "app_role", app_role: "admin_staff" },
      can_reject: false,
      can_return: false,
      comment_required_on_forward: true,
      attendance_required: true,
      decision_label: "Forward",
    },
    {
      step_key: "hackathon_incharge",
      label: "Hackathon Incharge",
      resolver: { kind: "assignment", scope_key: null },
      can_reject: true,
      can_return: true,
      comment_required_on_reject: true,
    },
    {
      step_key: "hod",
      label: "HOD",
      resolver: { kind: "role_same_department", role: "hod" },
      can_reject: true,
      can_return: true,
      comment_required_on_reject: true,
    },
    {
      step_key: "director",
      label: "Director",
      resolver: { kind: "role", role: "director" },
      can_reject: true,
      can_return: true,
      comment_required_on_reject: true,
    },
  ];

  const reCaChain: ApprovalChain = [
    {
      step_key: "class_teacher",
      label: "Course Faculty",
      resolver: { kind: "applicant_selected" },
      can_reject: true,
      can_return: true,
      comment_required_on_reject: true,
    },
    {
      step_key: "hod",
      label: "HOD",
      resolver: { kind: "role_same_department", role: "hod" },
      can_reject: true,
      can_return: true,
      comment_required_on_reject: true,
    },
    {
      step_key: "exam_cell",
      label: "Exam Cell",
      resolver: { kind: "app_role", app_role: "exam_cell" },
      can_reject: true,
      can_return: true,
      comment_required_on_reject: true,
    },
  ];

  const generalChain: ApprovalChain = [
    {
      step_key: "class_teacher",
      label: "Class Teacher",
      resolver: { kind: "applicant_selected" },
      can_reject: true,
      can_return: true,
      comment_required_on_reject: true,
    },
    {
      step_key: "hod",
      label: "HOD",
      resolver: { kind: "role_same_department", role: "hod" },
      can_reject: true,
      can_return: true,
      comment_required_on_reject: true,
    },
  ];

  it("successfully parses Hackathon, Re-CA and General chains", () => {
    expect(parseChain(hackathonChain).length).toBe(4);
    expect(parseChain(reCaChain).length).toBe(3);
    expect(parseChain(generalChain).length).toBe(2);
  });

  describe("Dynamic Approver Resolvers (app_role & assignment)", () => {
    const mockCtx: ApproverResolutionContext = {
      async findPersonsByRoleAndDept(role, dept) {
        if (role === "hod" && dept === "CSE") return ["T004"];
        return [];
      },
      async findPersonsByRole(role) {
        if (role === "director") return ["T001"];
        return [];
      },
      async findPersonsByAppRole(appRole) {
        if (appRole === "admin_staff") return ["STA5001"];
        if (appRole === "exam_cell") return ["T009"];
        return [];
      },
      async findAssignedApprover(appType, stepKey) {
        if (appType === "hackathon" && stepKey === "hackathon_incharge") {
          return "T036"; // Dr. Sachin Harne
        }
        return null;
      },
    };

    it("resolves admin_staff app_role dynamically", async () => {
      const approver = await resolveApprover(
        { kind: "app_role", app_role: "admin_staff" },
        { applicationType: "hackathon", stepKey: "admin_staff", applicantDepartment: "CSE" },
        mockCtx
      );
      expect(approver).toBe("STA5001");
    });

    it("resolves hackathon_incharge assignment dynamically to Sachin Sir (T036)", async () => {
      const approver = await resolveApprover(
        { kind: "assignment", scope_key: null },
        { applicationType: "hackathon", stepKey: "hackathon_incharge", applicantDepartment: "CSE" },
        mockCtx
      );
      expect(approver).toBe("T036");
    });

    it("throws clear error when assignment is missing", async () => {
      await expect(
        resolveApprover(
          { kind: "assignment", scope_key: null },
          { applicationType: "unknown_comp", stepKey: "incharge", applicantDepartment: "CSE" },
          mockCtx
        )
      ).rejects.toThrowError(ApproverResolutionError);
    });
  });

  describe("Forward-Only Step Transitions & Security Enforcements", () => {
    const appAtAdminStep: ApplicationState = {
      id: "app-hackathon-1",
      status: "in_review",
      current_step: 0,
      current_approver_login_id: "STA5001",
    };

    it("Test A4: Rejecting on a step with can_reject:false returns 403 STEP_CANNOT_REJECT", () => {
      const result = calculateTransition(
        appAtAdminStep,
        hackathonChain,
        "STA5001",
        "reject",
        "Attempting invalid rejection"
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.httpStatus).toBe(403);
        expect(result.code).toBe("STEP_CANNOT_REJECT");
      }
    });

    it("Returning on a step with can_return:false returns 403 STEP_CANNOT_RETURN", () => {
      const result = calculateTransition(
        appAtAdminStep,
        hackathonChain,
        "STA5001",
        "return",
        "Attempting return"
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.httpStatus).toBe(403);
        expect(result.code).toBe("STEP_CANNOT_RETURN");
      }
    });

    it("Forwarding without attendance percentage fails with 422 ATTENDANCE_REQUIRED", () => {
      const result = calculateTransition(
        appAtAdminStep,
        hackathonChain,
        "STA5001",
        "forward",
        "Attendance looks fine",
        {}
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.httpStatus).toBe(422);
        expect(result.code).toBe("ATTENDANCE_REQUIRED");
      }
    });

    it("Forwarding with invalid attendance (<0 or >100) fails with 422 INVALID_ATTENDANCE", () => {
      const result = calculateTransition(
        appAtAdminStep,
        hackathonChain,
        "STA5001",
        "forward",
        "Attendance note",
        { attendance_percentage: 120 }
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.httpStatus).toBe(422);
        expect(result.code).toBe("INVALID_ATTENDANCE");
      }
    });

    it("Forwarding without attendance comment succeeds when attendance percentage is provided (comment is optional)", () => {
      const result = calculateTransition(
        appAtAdminStep,
        hackathonChain,
        "STA5001",
        "forward",
        "",
        { attendance_percentage: 85.5 }
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.decision).toBe("forwarded");
        expect(result.comment).toContain("85.50%");
      }
    });

    it("Forwarding with valid float attendance and comment advances to step 1 with decision 'forwarded'", () => {
      const result = calculateTransition(
        appAtAdminStep,
        hackathonChain,
        "STA5001",
        "forward",
        "Verified ERP attendance records",
        { attendance_percentage: 87.25 }
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.new_status).toBe("in_review");
        expect(result.new_step).toBe(1);
        expect(result.decision).toBe("forwarded");
        expect(result.comment).toContain("Attendance: 87.25%");
        expect(result.comment).toContain("Verified ERP attendance records");
        expect(result.attendance_percentage).toBe(87.25);
      }
    });
  });

  describe("End-to-End In-Memory Transitions across All 4 Types", () => {
    it("runs complete 4-step Hackathon flow to final approval", () => {
      // Step 0: admin_staff forwards
      let app: ApplicationState = {
        id: "hack-101",
        status: "in_review",
        current_step: 0,
        current_approver_login_id: "STA5001",
      };
      const res0 = calculateTransition(
        app,
        hackathonChain,
        "STA5001",
        "forward",
        "OK",
        { attendance_percentage: 82.5 }
      );
      expect(res0.ok).toBe(true);
      if (res0.ok) {
        expect(res0.decision).toBe("forwarded");
        expect(res0.new_step).toBe(1);
      }

      // Step 1: hackathon_incharge (T036 Dr. Sachin Harne) approves
      app = { ...app, current_step: 1, current_approver_login_id: "T036" };
      const res1 = calculateTransition(app, hackathonChain, "T036", "approve", "Approved by incharge");
      expect(res1.ok).toBe(true);
      if (res1.ok) expect(res1.new_step).toBe(2);

      // Step 2: HOD (T004) approves
      app = { ...app, current_step: 2, current_approver_login_id: "T004" };
      const res2 = calculateTransition(app, hackathonChain, "T004", "approve", "Recommended by HOD");
      expect(res2.ok).toBe(true);
      if (res2.ok) expect(res2.new_step).toBe(3);

      // Step 3: Director (T001) final approval
      app = { ...app, current_step: 3, current_approver_login_id: "T001" };
      const res3 = calculateTransition(app, hackathonChain, "T001", "approve", "Approved by Director");
      expect(res3.ok).toBe(true);
      if (res3.ok) {
        expect(res3.new_status).toBe("approved");
        expect(res3.decision).toBe("approved");
      }
    });

    it("runs complete 3-step Re-CA flow to final approval", () => {
      let app: ApplicationState = {
        id: "reca-101",
        status: "in_review",
        current_step: 0,
        current_approver_login_id: "T003",
      };
      // Faculty approves
      const res0 = calculateTransition(app, reCaChain, "T003", "approve", "Permitted re-test");
      expect(res0.ok).toBe(true);

      // HOD approves
      app = { ...app, current_step: 1, current_approver_login_id: "T004" };
      const res1 = calculateTransition(app, reCaChain, "T004", "approve", "HOD ok");
      expect(res1.ok).toBe(true);

      // Exam Cell approves
      app = { ...app, current_step: 2, current_approver_login_id: "T009" };
      const res2 = calculateTransition(app, reCaChain, "T009", "approve", "Exam schedule confirmed");
      expect(res2.ok).toBe(true);
      if (res2.ok) {
        expect(res2.new_status).toBe("approved");
      }
    });

    it("runs complete 2-step General application flow to final approval", () => {
      let app: ApplicationState = {
        id: "gen-101",
        status: "in_review",
        current_step: 0,
        current_approver_login_id: "T003",
      };
      const res0 = calculateTransition(app, generalChain, "T003", "approve", "Faculty signed");
      expect(res0.ok).toBe(true);

      app = { ...app, current_step: 1, current_approver_login_id: "T004" };
      const res1 = calculateTransition(app, generalChain, "T004", "approve", "HOD signed");
      expect(res1.ok).toBe(true);
      if (res1.ok) {
        expect(res1.new_status).toBe("approved");
      }
    });
  });

  describe("People CSV Import Validation", () => {
    it("accepts valid CSV with required headers", () => {
      const csv = `login_id,name,college_email,role,department
T088,Dr. Sample Teacher,teacher@sitnagpur.siu.edu.in,faculty,CSE
24070521999,Rohan Student,rohan@sitnagpur.siu.edu.in,student,CSE`;

      const result = parseAndValidateCsv(csv);
      expect(result.valid).toBe(true);
      expect(result.rows?.length).toBe(2);
      expect(result.rows?.[0].login_id).toBe("T088");
      expect(result.rows?.[1].role).toBe("student");
    });

    it("rejects CSV with missing required columns in header", () => {
      const csv = `login_id,name,role
T088,Dr. Sample Teacher,faculty`;
      const result = parseAndValidateCsv(csv);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Invalid CSV header");
    });

    it("rejects CSV with duplicate login_ids", () => {
      const csv = `login_id,name,college_email,role,department
T088,Dr. Teacher One,t1@sitnagpur.siu.edu.in,faculty,CSE
T088,Dr. Teacher Two,t2@sitnagpur.siu.edu.in,faculty,CSE`;
      const result = parseAndValidateCsv(csv);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Duplicate login_id");
    });

    it("rejects CSV with invalid role", () => {
      const csv = `login_id,name,college_email,role,department
T088,Dr. Teacher One,t1@sitnagpur.siu.edu.in,super_admin_role,CSE`;
      const result = parseAndValidateCsv(csv);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("expected one of");
    });
  });

  describe("Urgent Application Sorting", () => {
    it("sorts urgent applications first regardless of submission time", () => {
      const apps = [
        { id: "1", subject: "Routine App 1", urgent: false, created_at: "2026-10-25T10:00:00Z" },
        { id: "2", subject: "Routine App 2", urgent: false, created_at: "2026-10-26T10:00:00Z" },
        { id: "3", subject: "Urgent Hackathon", urgent: true, created_at: "2026-10-28T10:00:00Z" },
      ];

      const sorted = [...apps].sort((a, b) => {
        if (a.urgent !== b.urgent) {
          return a.urgent ? -1 : 1;
        }
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });

      expect(sorted[0].id).toBe("3");
      expect(sorted[0].urgent).toBe(true);
      expect(sorted[1].id).toBe("1");
      expect(sorted[2].id).toBe("2");
    });
  });
});
