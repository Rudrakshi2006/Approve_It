import { describe, it, expect, beforeAll, vi } from "vitest";
import { submitApplication } from "../applications/submit";
import { submitEmployeeLeave } from "../applications/submit-employee";
import { getTodayIST } from "../dates";
import type { Session } from "../session";

vi.mock("@/lib/db", () => ({
  getDb: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: {
              name: "Test App",
              enabled: true,
              chain: [
                {
                  step_key: "step1",
                  label: "Step 1",
                  resolver: { kind: "role", role: "director" },
                },
              ],
            },
            error: null,
          }),
        }),
      }),
    }),
  }),
}));

describe("Application Date Rules Validation", () => {
  beforeAll(() => {
    process.env.APP_SESSION_SECRET = "01234567890123456789012345678901234567890123456789";
    process.env.EKLINK_URL = "https://eklink-test.vercel.app";
    process.env.EKLINK_ISSUER = "https://eklink-test.vercel.app";
    process.env.EKLINK_CLIENT_ID = "client";
    process.env.EKLINK_CLIENT_SECRET = "secret";
    process.env.EKLINK_REDIRECT_URI = "http://localhost:3002/auth/callback";
    process.env.APP_URL = "http://localhost:3002";
    process.env.SUPABASE_URL = "https://test.supabase.co";
    process.env.SUPABASE_SECRET_KEY = "test_secret_key";
  });
  const studentSession: Session = {
    sub: "dev-sub-stu1",
    login_id: "24070521001",
    name: "Rudra Student",
    email: "rudra@sitnagpur.siu.edu.in",
    eklink_role: "student",
    department: "CSE",
    batch: "2024-28",
    section: "A",
    tok: "dev.tok.val",
    tok_exp: Math.floor(Date.now() / 1000) + 3600,
    exp: Math.floor(Date.now() / 1000) + 28800,
  };

  const facultySession: Session = {
    sub: "dev-sub-fac1",
    login_id: "T017",
    name: "Dr. Mrudula Nimbarte",
    email: "mrudula.nimbarte@sitnagpur.siu.edu.in",
    eklink_role: "faculty",
    department: "CSE",
    batch: null,
    section: null,
    tok: "dev.tok.val",
    tok_exp: Math.floor(Date.now() / 1000) + 3600,
    exp: Math.floor(Date.now() / 1000) + 28800,
  };

  const dummyAttachment = [
    {
      storage_path: "test/doc.pdf",
      original_name: "doc.pdf",
      size_bytes: 1024,
      mime: "application/pdf",
    },
  ];

  const today = getTodayIST();

  describe("Faculty Leave Date Rules", () => {
    it("rejects past dates for faculty leave", async () => {
      const res = await submitEmployeeLeave(facultySession, {
        leave_type: "personal",
        from_date: "2020-01-01",
        reason: "Old date leave",
      });
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toMatch(/Past dates are not allowed/i);
      }
    });

    it("accepts from_date with optional to_date (defaults to single day)", async () => {
      // Future date
      const futureDate = "2026-11-20";
      // This will proceed past date validation to chain resolution/db
      const res = await submitEmployeeLeave(facultySession, {
        leave_type: "personal",
        from_date: futureDate,
        reason: "Valid future leave single day",
      });
      // Date validation passed (even if DB or mock returns ok/error)
      if (!res.ok) {
        expect(res.error).not.toMatch(/Past dates are not allowed/i);
        expect(res.error).not.toMatch(/From Date cannot be later than To Date/i);
      }
    });
  });

  describe("Student Medical Date Rules", () => {
    it("rejects future dates for medical leave", async () => {
      const res = await submitApplication(studentSession, {
        type: "medical",
        subject: "Medical Leave Future",
        class_teacher_login_id: "T017",
        payload: {
          from_date: "2099-01-01",
          to_date: "2099-01-02",
        },
        attachments: dummyAttachment,
      });
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toMatch(/past illness and current date/i);
      }
    });

    it("allows current date (today) for medical leave", async () => {
      const res = await submitApplication(studentSession, {
        type: "medical",
        subject: "Medical Leave Today",
        class_teacher_login_id: "T017",
        payload: {
          from_date: today,
        },
        attachments: dummyAttachment,
      });
      // Date validation should not reject today
      if (!res.ok) {
        expect(res.error).not.toMatch(/past illness and current date/i);
      }
    });
  });

  describe("Hackathon Date Rules", () => {
    it("rejects past dates for hackathon", async () => {
      const res = await submitApplication(studentSession, {
        type: "hackathon",
        subject: "Hackathon Leave Past",
        payload: {
          event_name: "Past Hackathon",
          from_date: "2020-01-01",
        },
        attachments: dummyAttachment,
      });
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toMatch(/Hackathon dates cannot be in the past/i);
      }
    });

    it("allows current date (today) and future dates for hackathon", async () => {
      const res = await submitApplication(studentSession, {
        type: "hackathon",
        subject: "Hackathon Leave Today",
        payload: {
          event_name: "Today Hackathon",
          from_date: today,
        },
        attachments: dummyAttachment,
      });
      if (!res.ok) {
        expect(res.error).not.toMatch(/Hackathon dates cannot be in the past/i);
      }
    });
  });

  describe("Re-CA Date Rules", () => {
    it("rejects future dates for Re-CA", async () => {
      const res = await submitApplication(studentSession, {
        type: "re_ca",
        subject: "Re-CA Exam Future",
        class_teacher_login_id: "T017",
        payload: {
          ca_date: "2099-01-01",
        },
        attachments: dummyAttachment,
      });
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toMatch(/tests missed today or in the past/i);
      }
    });

    it("allows current date (today) and past dates for Re-CA", async () => {
      const res = await submitApplication(studentSession, {
        type: "re_ca",
        subject: "Re-CA Exam Today",
        class_teacher_login_id: "T017",
        payload: {
          ca_date: today,
        },
        attachments: dummyAttachment,
      });
      if (!res.ok) {
        expect(res.error).not.toMatch(/tests missed today or in the past/i);
      }
    });
  });
});
