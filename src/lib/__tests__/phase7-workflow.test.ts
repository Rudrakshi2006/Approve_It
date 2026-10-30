import { describe, it, expect } from "vitest";
import { calculateTransition } from "../workflow/transitions";
import type { ApprovalChain } from "../workflow/chains";

describe("Phase 7: Workflow Engine Extension (Task 7.4)", () => {
  const employeeLeaveChain: ApprovalChain = [
    {
      step_key: "hod",
      label: "Head of Department",
      resolver: { kind: "role_same_department", role: "hod" },
      can_reject: false,
      can_return: true,
      comment_required_on_return: true,
      decision_label: "Verify and forward",
    },
    {
      step_key: "director",
      label: "Director",
      resolver: { kind: "role", role: "director" },
      can_reject: true,
      can_return: true,
      comment_required_on_reject: true,
      comment_required_on_return: true,
    },
  ];

  const hodLeaveChain: ApprovalChain = [
    {
      step_key: "director",
      label: "Director",
      resolver: { kind: "role", role: "director" },
      can_reject: true,
      can_return: true,
      comment_required_on_reject: true,
      comment_required_on_return: true,
    },
  ];

  it("HOD step on employee leave forbids rejection (can_reject: false)", () => {
    const res = calculateTransition(
      {
        id: "leave-app-1",
        status: "in_review",
        current_step: 0,
        current_approver_login_id: "T004", // HOD
      },
      employeeLeaveChain,
      "T004",
      "reject",
      "I want to reject"
    );

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe("STEP_CANNOT_REJECT");
      expect(res.httpStatus).toBe(403);
    }
  });

  it("HOD step allows return with comment", () => {
    const res = calculateTransition(
      {
        id: "leave-app-1",
        status: "in_review",
        current_step: 0,
        current_approver_login_id: "T004",
      },
      employeeLeaveChain,
      "T004",
      "return",
      "Please provide medical certificate"
    );

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.new_status).toBe("returned");
      expect(res.decision).toBe("returned");
      expect(res.comment).toBe("Please provide medical certificate");
    }
  });

  it("HOD step forwards to Director on 'Verify and forward' (approve or forward action)", () => {
    const res = calculateTransition(
      {
        id: "leave-app-1",
        status: "in_review",
        current_step: 0,
        current_approver_login_id: "T004",
      },
      employeeLeaveChain,
      "T004",
      "approve",
      "Verified syllabus coverage"
    );

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.new_status).toBe("in_review");
      expect(res.new_step).toBe(1);
      expect(res.decision).toBe("forwarded");
      expect(res.next_step_config?.step_key).toBe("director");
    }
  });

  it("Director step final approval completes the application", () => {
    const res = calculateTransition(
      {
        id: "leave-app-1",
        status: "in_review",
        current_step: 1,
        current_approver_login_id: "DIR001",
      },
      employeeLeaveChain,
      "DIR001",
      "approve",
      "Sanctioned"
    );

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.new_status).toBe("approved");
      expect(res.decision).toBe("approved");
    }
  });

  it("HOD leave single-step chain directly approves on Director decision", () => {
    const res = calculateTransition(
      {
        id: "hod-leave-app-1",
        status: "in_review",
        current_step: 0,
        current_approver_login_id: "DIR001",
      },
      hodLeaveChain,
      "DIR001",
      "approve"
    );

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.new_status).toBe("approved");
      expect(res.decision).toBe("approved");
    }
  });
});
