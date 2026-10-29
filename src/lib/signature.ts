import "server-only";
import { getDb } from "./db";
import { validateMagicBytes } from "./attachments";

export const SIGNATURE_CONFIG = {
  MAX_FILE_SIZE_BYTES: 1 * 1024 * 1024, // 1 MB
  ALLOWED_EXTENSIONS: [".png", ".jpg", ".jpeg"] as const,
  BUCKET_NAME: "signatures",
  SIGNED_URL_EXPIRY_SECONDS: 60,
};

export function validateSignatureFile(
  buffer: Uint8Array,
  sizeBytes: number
): { valid: boolean; mime?: string; error?: string } {
  if (sizeBytes > SIGNATURE_CONFIG.MAX_FILE_SIZE_BYTES) {
    return { valid: false, error: "Signature file exceeds 1 MB limit" };
  }

  const magic = validateMagicBytes(buffer);
  if (!magic.valid || !magic.detectedMime) {
    return { valid: false, error: "Invalid signature format" };
  }

  // Only PNG and JPEG allowed for signatures (no PDFs)
  if (magic.detectedMime !== "image/png" && magic.detectedMime !== "image/jpeg") {
    return {
      valid: false,
      error: "Only PNG and JPEG image formats are allowed for signatures",
    };
  }

  return { valid: true, mime: magic.detectedMime };
}

export async function createSignatureSignedUrl(storagePath: string): Promise<string | null> {
  if (!storagePath) return null;
  const db = getDb();
  const { data, error } = await db.storage
    .from(SIGNATURE_CONFIG.BUCKET_NAME)
    .createSignedUrl(storagePath, SIGNATURE_CONFIG.SIGNED_URL_EXPIRY_SECONDS);

  if (error || !data) {
    return null;
  }

  return data.signedUrl;
}
