import "server-only";
import { getDb } from "./db";

export const ATTACHMENT_CONFIG = {
  MAX_FILES_PER_APPLICATION: 10,
  MAX_FILE_SIZE_BYTES: 5 * 1024 * 1024, // 5 MB
  ALLOWED_EXTENSIONS: [".pdf", ".jpg", ".jpeg", ".png"] as const,
  ALLOWED_MIME_TYPES: [
    "application/pdf",
    "image/jpeg",
    "image/png",
  ] as const,
  SIGNED_URL_EXPIRY_SECONDS: 60,
  BUCKET_NAME: "attachments",
};

/**
 * Validates magic bytes for security against file extension spoofing:
 * - PDF: %PDF (0x25 0x50 0x44 0x46)
 * - JPEG: 0xFF 0xD8 0xFF
 * - PNG: 0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A
 */
export function validateMagicBytes(buffer: Uint8Array): {
  valid: boolean;
  detectedMime?: string;
  error?: string;
} {
  if (buffer.length < 4) {
    return { valid: false, error: "File too small or empty" };
  }

  // Check PDF
  if (
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46
  ) {
    return { valid: true, detectedMime: "application/pdf" };
  }

  // Check PNG
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { valid: true, detectedMime: "image/png" };
  }

  // Check JPEG
  if (
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return { valid: true, detectedMime: "image/jpeg" };
  }

  return { valid: false, error: "File content does not match allowed types (PDF, JPG, PNG)" };
}

/**
 * Generates a short-lived signed URL for an attachment object in the private bucket.
 */
export async function createAttachmentSignedUrl(storagePath: string): Promise<string | null> {
  const db = getDb();
  const { data, error } = await db.storage
    .from(ATTACHMENT_CONFIG.BUCKET_NAME)
    .createSignedUrl(storagePath, ATTACHMENT_CONFIG.SIGNED_URL_EXPIRY_SECONDS);

  if (error || !data) {
    return null;
  }

  return data.signedUrl;
}
