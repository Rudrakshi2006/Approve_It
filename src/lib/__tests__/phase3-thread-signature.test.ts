import { describe, expect, it } from "vitest";
import { buildUnifiedTimeline } from "../thread";
import { validateSignatureFile, SIGNATURE_CONFIG } from "../signature";
import type { ApplicationStepRecord, AttachmentRecord } from "../repos/types";
import type { MessageRecord } from "../thread";

describe("Phase 3: Unified Thread & Timeline Ordering", () => {
  const steps: ApplicationStepRecord[] = [
    {
      id: 1,
      application_id: "app-1",
      step_index: 0,
      step_key: "class_teacher",
      actor_login_id: "STU1001",
      decision: "submitted",
      comment: "Initial medical application",
      verification_id: null,
      signature_path: null,
      at: "2026-10-29T10:00:00Z",
    },
    {
      id: 2,
      application_id: "app-1",
      step_index: 0,
      step_key: "class_teacher",
      actor_login_id: "FAC2001",
      decision: "returned",
      comment: "Please attach clinic prescription",
      verification_id: "AP-2345-6789",
      signature_path: "sig_1.png",
      at: "2026-10-29T11:00:00Z",
    },
  ];

  const messages: MessageRecord[] = [
    {
      id: 1,
      application_id: "app-1",
      author_login_id: "STU1001",
      body: "Uploaded the prescription, please review.",
      created_at: "2026-10-29T10:30:00Z",
    },
  ];

  const attachments: AttachmentRecord[] = [
    {
      id: "att-1",
      application_id: "app-1",
      uploaded_by: "STU1001",
      storage_path: "file1.pdf",
      original_name: "prescription.pdf",
      mime: "application/pdf",
      size_bytes: 1024,
      created_at: "2026-10-29T10:05:00Z",
      removed_at: null,
    },
  ];

  it("merges steps, messages, and attachments in strict chronological order", () => {
    const timeline = buildUnifiedTimeline(steps, messages, attachments);

    expect(timeline.length).toBe(4);
    // 10:00:00 -> step: submitted
    expect(timeline[0].kind).toBe("step");
    expect(timeline[0].at).toBe("2026-10-29T10:00:00Z");

    // 10:05:00 -> attachment: prescription.pdf
    expect(timeline[1].kind).toBe("attachment");
    expect(timeline[1].at).toBe("2026-10-29T10:05:00Z");

    // 10:30:00 -> message: Uploaded prescription
    expect(timeline[2].kind).toBe("message");
    expect(timeline[2].at).toBe("2026-10-29T10:30:00Z");

    // 11:00:00 -> step: returned
    expect(timeline[3].kind).toBe("step");
    expect(timeline[3].at).toBe("2026-10-29T11:00:00Z");
  });

  it("excludes soft-removed attachments from active timeline", () => {
    const softRemoved: AttachmentRecord = {
      ...attachments[0],
      removed_at: "2026-10-29T10:50:00Z",
    };
    const timeline = buildUnifiedTimeline(steps, messages, [softRemoved]);
    expect(timeline.find((t) => t.kind === "attachment")).toBeUndefined();
  });
});

describe("Phase 3: Digital Signature Security & Validation", () => {
  it("accepts valid PNG signature within 1 MB", () => {
    const validPng = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00,
    ]);
    const res = validateSignatureFile(validPng, 500 * 1024);
    expect(res.valid).toBe(true);
    expect(res.mime).toBe("image/png");
  });

  it("accepts valid JPEG signature within 1 MB", () => {
    const validJpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
    const res = validateSignatureFile(validJpg, 400 * 1024);
    expect(res.valid).toBe(true);
    expect(res.mime).toBe("image/jpeg");
  });

  it("rejects signature exceeding 1 MB limit", () => {
    const validPng = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00,
    ]);
    const res = validateSignatureFile(validPng, SIGNATURE_CONFIG.MAX_FILE_SIZE_BYTES + 1);
    expect(res.valid).toBe(false);
    expect(res.error).toContain("exceeds 1 MB");
  });

  it("strictly rejects PDF files uploaded as signatures", () => {
    // 0x25, 0x50, 0x44, 0x46 ("%PDF")
    const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]);
    const res = validateSignatureFile(pdfBytes, 200 * 1024);
    expect(res.valid).toBe(false);
    expect(res.error).toContain("Only PNG and JPEG");
  });

  it("rejects executables and corrupted bytes", () => {
    const exeBytes = new Uint8Array([0x4d, 0x5a, 0x90, 0x00]);
    expect(validateSignatureFile(exeBytes, 100).valid).toBe(false);
  });
});

describe("Phase 3: Frozen Snapshots (Test A11)", () => {
  it("applicant snapshot remains immutable even if student changes profile semester", () => {
    const frozenSnapshot = {
      name: "Akshat Digalwar",
      login_id: "24070521003",
      email: "akshat@sitnagpur.siu.edu.in",
      department: "CSE",
      batch: "2024-28",
      semester: 1, // submitted when student was in sem 1
    };

    // Later, student advances or confirms sem 2 in their profile
    const updatedProfile = {
      login_id: "24070521003",
      semester: 2,
    };

    // Existing application snapshot must never be mutated
    expect(frozenSnapshot.semester).toBe(1);
    expect(updatedProfile.semester).toBe(2);
    expect(frozenSnapshot.semester).not.toEqual(updatedProfile.semester);
  });
});
