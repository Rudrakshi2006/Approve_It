import { describe, it, expect } from "vitest";
import { submitEmployeeGeneral, submitEmployeeLeave } from "../applications/submit-employee";
import type { Session } from "../session";

describe("Phase 7: Employee Applications & Leave API Validation (Task 7.5)", () => {
  const studentSession: Session = {
    sub: "dev-sub-24070521001",
    login_id: "24070521001",
    name: "Student A",
    email: "student.a@sitnagpur.siu.edu.in",
    eklink_role: "student",
    department: "CSE",
    batch: "2024-28",
    section: "A",
    tok: "dev.tok.val",
    tok_exp: Math.floor(Date.now() / 1000) + 3600,
    exp: Math.floor(Date.now() / 1000) + 28800,
  };

  const facultySession: Session = {
    sub: "dev-sub-t036",
    login_id: "T036",
    name: "Dr. Sachin Harne",
    email: "sachin.harne@sitnagpur.siu.edu.in",
    eklink_role: "faculty",
    department: "CSE",
    batch: null,
    section: null,
    tok: "dev.tok.val",
    tok_exp: Math.floor(Date.now() / 1000) + 3600,
    exp: Math.floor(Date.now() / 1000) + 28800,
  };

  it("blocks students from submitting employee general applications", async () => {
    const res = await submitEmployeeGeneral(studentSession, {
      category: "Event proposal",
      subject: "Test Proposal",
      description: "Test description for event proposal",
    });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.status).toBe(403);
      expect(res.error).toMatch(/Students cannot submit/i);
    }
  });

  it("blocks students from submitting employee leave applications", async () => {
    const res = await submitEmployeeLeave(studentSession, {
      leave_type: "personal",
      from_date: "10-11-2026",
      to_date: "12-11-2026",
      reason: "Personal work",
    });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.status).toBe(403);
      expect(res.error).toMatch(/Students cannot submit/i);
    }
  });

  it("rejects leave submission if from_date is after to_date", async () => {
    const res = await submitEmployeeLeave(facultySession, {
      leave_type: "medical",
      from_date: "15-11-2026",
      to_date: "10-11-2026",
      reason: "Medical leave",
    });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.status).toBe(422);
      expect(res.error).toMatch(/cannot be later than/i);
    }
  });

  it("rejects leave submission if date format is invalid", async () => {
    const res = await submitEmployeeLeave(facultySession, {
      leave_type: "medical",
      from_date: "invalid-date",
      to_date: "10-11-2026",
      reason: "Medical leave",
    });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.status).toBe(422);
      expect(res.error).toMatch(/Invalid date format/i);
    }
  });
});
