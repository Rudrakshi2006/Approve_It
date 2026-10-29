import { describe, expect, it } from "vitest";
import {
  validateMagicBytes,
  ATTACHMENT_CONFIG,
} from "../attachments";

describe("Attachment Security & Magic Bytes Validation", () => {
  it("detects valid PDF magic bytes (%PDF)", () => {
    // 0x25, 0x50, 0x44, 0x46 ("%PDF")
    const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
    const result = validateMagicBytes(pdfBytes);
    expect(result.valid).toBe(true);
    expect(result.detectedMime).toBe("application/pdf");
  });

  it("detects valid PNG magic bytes", () => {
    // 89 50 4E 47 0D 0A 1A 0A
    const pngBytes = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00,
    ]);
    const result = validateMagicBytes(pngBytes);
    expect(result.valid).toBe(true);
    expect(result.detectedMime).toBe("image/png");
  });

  it("detects valid JPEG magic bytes", () => {
    // FF D8 FF
    const jpgBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    const result = validateMagicBytes(jpgBytes);
    expect(result.valid).toBe(true);
    expect(result.detectedMime).toBe("image/jpeg");
  });

  it("rejects executable (.exe / ELF) masquerading as document", () => {
    // MZ header (Windows executable)
    const exeBytes = new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00]);
    const result = validateMagicBytes(exeBytes);
    expect(result.valid).toBe(false);
  });

  it("rejects random corrupt or empty bytes", () => {
    const emptyBytes = new Uint8Array([]);
    expect(validateMagicBytes(emptyBytes).valid).toBe(false);

    const corruptBytes = new Uint8Array([0x00, 0x01, 0x02]);
    expect(validateMagicBytes(corruptBytes).valid).toBe(false);
  });

  it("verifies config limits", () => {
    expect(ATTACHMENT_CONFIG.MAX_FILES_PER_APPLICATION).toBe(10);
    expect(ATTACHMENT_CONFIG.MAX_FILE_SIZE_BYTES).toBe(5 * 1024 * 1024); // 5 MB
    expect(ATTACHMENT_CONFIG.BUCKET_NAME).toBe("attachments");
  });
});
