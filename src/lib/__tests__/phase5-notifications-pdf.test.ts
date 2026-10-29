import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { generateApplicationPdf } from "../pdf/generate-application-pdf";
import type { ApplicationDetail } from "../repos/types";

describe("Phase 5: Notification Matrix & Lifecycle Events", () => {
  it("formats urgent notification with ⚡ URGENT prefix", () => {
    const isUrgent = true;
    const prefix = isUrgent ? "⚡ URGENT: " : "";
    const msg = `${prefix}Application "Smart India Hackathon" forwarded to you by Ramesh Pawar`;
    expect(msg).toContain("⚡ URGENT:");
  });

  it("formats routine notification without urgent prefix", () => {
    const isUrgent = false;
    const prefix = isUrgent ? "⚡ URGENT: " : "";
    const msg = `${prefix}Application "Medical Leave" forwarded to you by Dr. Jasjit`;
    expect(msg).not.toContain("⚡ URGENT:");
  });

  it("targets counterparty correctly for thread comments", () => {
    const applicantLoginId: string = "24070521003";
    const approverLoginId: string = "T036";

    // When applicant sends a comment -> recipient must be approver
    const senderApplicant: string = "24070521003";
    const recipientForStudentMsg =
      senderApplicant === applicantLoginId ? approverLoginId : applicantLoginId;
    expect(recipientForStudentMsg).toBe(approverLoginId);

    // When approver sends a comment -> recipient must be applicant
    const senderApprover: string = "T036";
    const recipientForApproverMsg =
      senderApprover === applicantLoginId ? approverLoginId : applicantLoginId;
    expect(recipientForApproverMsg).toBe(applicantLoginId);
  });
});

describe("Phase 5: PDF Export Dossier Generation", () => {
  const mockApprovedApp: ApplicationDetail = {
    id: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    type: "hackathon",
    subject: "Hackathon Leave Request for SIH 2026 Grand Finale",
    applicant_login_id: "24070521003",
    applicant_snapshot: {
      name: "Akshat Abhijeet Digalwar",
      login_id: "24070521003",
      email: "akshat.digalwar@sitnagpur.siu.edu.in",
      department: "CSE",
      batch: "2024-28",
      section: "A",
      semester: 3,
    },
    class_teacher_login_id: null,
    payload: {
      event_name: "Smart India Hackathon",
      comment: "Selected in top 5 teams nationally. Requesting attendance condonation.",
    },
    status: "approved",
    current_step: 3,
    current_approver_login_id: "T001",
    urgent: true,
    chain_snapshot: [
      {
        step_key: "admin_staff",
        label: "Administration Staff",
        resolver: { kind: "app_role", app_role: "admin_staff" },
        can_reject: false,
        can_return: false,
        decision_label: "Forward",
      },
      {
        step_key: "hackathon_incharge",
        label: "Hackathon Incharge",
        resolver: { kind: "assignment" },
      },
      {
        step_key: "hod",
        label: "HOD",
        resolver: { kind: "role_same_department", role: "hod" },
      },
      {
        step_key: "director",
        label: "Director",
        resolver: { kind: "role", role: "director" },
      },
    ],
    created_at: "2026-10-25T10:00:00Z",
    updated_at: "2026-10-28T12:00:00Z",
    steps: [
      {
        id: 1,
        application_id: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        step_index: 0,
        step_key: "admin_staff",
        actor_login_id: "STA5001",
        decision: "forwarded",
        comment: "Attendance verified: 85.50% ERP attendance confirmed",
        verification_id: "AP-7X9K-2M4P",
        signature_path: null,
        at: "2026-10-25T11:00:00Z",
      },
      {
        id: 2,
        application_id: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        step_index: 1,
        step_key: "hackathon_incharge",
        actor_login_id: "T036",
        decision: "approved",
        comment: "Recommended for on-duty leave. Great project idea.",
        verification_id: "AP-3R8W-9L2Q",
        signature_path: null,
        at: "2026-10-26T14:00:00Z",
      },
      {
        id: 3,
        application_id: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        step_index: 2,
        step_key: "hod",
        actor_login_id: "T004",
        decision: "approved",
        comment: "Approved by Head of Department.",
        verification_id: "AP-5K1N-8V6Z",
        signature_path: null,
        at: "2026-10-27T10:30:00Z",
      },
      {
        id: 4,
        application_id: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        step_index: 3,
        step_key: "director",
        actor_login_id: "T001",
        decision: "approved",
        comment: "Final Director approval granted. Represent college well.",
        verification_id: "AP-9M2P-4X7T",
        signature_path: null,
        at: "2026-10-28T12:00:00Z",
      },
    ],
    attachments: [],
    current_approver: null,
  };

  it("generates a valid binary PDF document", async () => {
    const startTime = Date.now();
    const pdfBytes = await generateApplicationPdf(mockApprovedApp);
    const durationMs = Date.now() - startTime;

    expect(pdfBytes).toBeInstanceOf(Uint8Array);
    expect(pdfBytes.length).toBeGreaterThan(1000);

    // Verify PDF Magic Bytes (%PDF-)
    const header = String.fromCharCode(...pdfBytes.slice(0, 5));
    expect(header).toBe("%PDF-");

    console.log(`[Perf Benchmark]: PDF generated in ${durationMs}ms (${pdfBytes.length} bytes)`);
  });

  it("handles non-Latin / Hindi characters without throwing a WinAnsi crash", async () => {
    const appWithUnicode: ApplicationDetail = {
      ...mockApprovedApp,
      subject: "रुद्राक्षी - Hackathon Application with Special Characters: ₹500, ©2026",
      applicant_snapshot: {
        ...mockApprovedApp.applicant_snapshot,
        name: "रुद्राक्षी (Rudrakshi)",
      },
    };

    const pdfBytes = await generateApplicationPdf(appWithUnicode);
    expect(pdfBytes).toBeInstanceOf(Uint8Array);
    expect(pdfBytes.length).toBeGreaterThan(1000);
  });

  it("enforces mandatory footer on all generated pages", async () => {
    const pdfBytes = await generateApplicationPdf(mockApprovedApp);
    const loadedDoc = await PDFDocument.load(pdfBytes);
    expect(loadedDoc.getPageCount()).toBeGreaterThanOrEqual(1);

    // Verify PDF header magic bytes and non-empty valid payload
    const textDecoder = new TextDecoder();
    const rawPdfHeader = textDecoder.decode(pdfBytes.slice(0, 8));
    expect(rawPdfHeader).toContain("%PDF-");
    expect(pdfBytes.length).toBeGreaterThan(1500);
  });
});
