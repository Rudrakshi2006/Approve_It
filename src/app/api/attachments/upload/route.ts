import { type NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth";
import { SESSION_COOKIE } from "@/lib/session";
import { getDb } from "@/lib/db";
import {
  ATTACHMENT_CONFIG,
  validateMagicBytes,
} from "@/lib/attachments";
import { randomUUID } from "node:crypto";

export async function POST(request: NextRequest) {
  const rawCookie = request.cookies.get(SESSION_COOKIE)?.value;
  const auth = await requireApiSession(rawCookie);

  if (auth.errorResponse) {
    return auth.errorResponse;
  }

  const { session } = auth;

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const applicationId = formData.get("application_id") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // 1. Validate file size
    if (file.size > ATTACHMENT_CONFIG.MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: "File exceeds maximum size of 5 MB" },
        { status: 422 }
      );
    }

    // 2. Validate file extension
    const originalName = file.name || "attachment";
    const lowerName = originalName.toLowerCase();
    const hasAllowedExt = ATTACHMENT_CONFIG.ALLOWED_EXTENSIONS.some((ext) =>
      lowerName.endsWith(ext)
    );

    if (!hasAllowedExt) {
      return NextResponse.json(
        { error: "File type not allowed. Only PDF, JPG, and PNG are permitted." },
        { status: 422 }
      );
    }

    // 3. Read buffer and validate magic bytes
    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);
    const magicResult = validateMagicBytes(buffer);

    if (!magicResult.valid || !magicResult.detectedMime) {
      return NextResponse.json(
        { error: magicResult.error || "File content does not match allowed types" },
        { status: 422 }
      );
    }

    // 4. Generate random storage path (never original filename)
    const ext = lowerName.substring(lowerName.lastIndexOf("."));
    const storagePath = `${randomUUID()}${ext}`;

    const db = getDb();

    // 5. Upload to Supabase private bucket
    const { error: uploadError } = await db.storage
      .from(ATTACHMENT_CONFIG.BUCKET_NAME)
      .upload(storagePath, buffer, {
        contentType: magicResult.detectedMime,
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json(
        { error: `Storage upload failed: ${uploadError.message}` },
        { status: 500 }
      );
    }

    // 6. Record in attachments table if applicationId is provided
    let attachmentId = randomUUID();
    if (applicationId) {
      const { data: insertData, error: dbError } = await db
        .from("attachments")
        .insert({
          id: attachmentId,
          application_id: applicationId,
          uploaded_by: session.login_id,
          storage_path: storagePath,
          original_name: originalName,
          mime: magicResult.detectedMime,
          size_bytes: file.size,
        })
        .select("id")
        .single();

      if (dbError) {
        // Rollback storage object
        await db.storage.from(ATTACHMENT_CONFIG.BUCKET_NAME).remove([storagePath]);
        return NextResponse.json(
          { error: `Database insert failed: ${dbError.message}` },
          { status: 500 }
        );
      }
      attachmentId = insertData.id;
    }

    return NextResponse.json({
      id: attachmentId,
      storage_path: storagePath,
      original_name: originalName,
      size_bytes: file.size,
      mime: magicResult.detectedMime,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
