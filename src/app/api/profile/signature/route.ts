import { type NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { requireApiSession } from "@/lib/auth";
import { SESSION_COOKIE } from "@/lib/session";
import { getDb } from "@/lib/db";
import { SIGNATURE_CONFIG, validateSignatureFile } from "@/lib/signature";

export async function POST(request: NextRequest) {
  const rawCookie = request.cookies.get(SESSION_COOKIE)?.value;
  const auth = await requireApiSession(rawCookie);

  if (auth.errorResponse) {
    return auth.errorResponse;
  }

  const { session } = auth;

  // Students are NOT allowed to upload digital signatures
  if (session.eklink_role === "student") {
    return NextResponse.json(
      { error: "Forbidden: Students are not authorized to upload signatures" },
      { status: 403 }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No signature file provided" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    // Validate size and magic bytes (PNG/JPG only)
    const validation = validateSignatureFile(buffer, file.size);
    if (!validation.valid || !validation.mime) {
      return NextResponse.json(
        { error: validation.error || "Invalid signature image" },
        { status: 422 }
      );
    }

    const ext = validation.mime.includes("png") ? ".png" : ".jpg";
    const storagePath = `sig_${randomUUID()}${ext}`;

    const db = getDb();

    // Upload to private signatures bucket
    const { error: uploadError } = await db.storage
      .from(SIGNATURE_CONFIG.BUCKET_NAME)
      .upload(storagePath, buffer, {
        contentType: validation.mime,
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json(
        { error: `Upload failed: ${uploadError.message}` },
        { status: 500 }
      );
    }

    // Versioning: update people.signature_path to point to this new version
    const { error: updateError } = await db
      .from("people")
      .update({
        signature_path: storagePath,
        updated_at: new Date().toISOString(),
      })
      .eq("login_id", session.login_id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, signature_path: storagePath });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to upload signature";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const rawCookie = request.cookies.get(SESSION_COOKIE)?.value;
  const auth = await requireApiSession(rawCookie);

  if (auth.errorResponse) {
    return auth.errorResponse;
  }

  const { session } = auth;

  if (session.eklink_role === "student") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const db = getDb();

  // Clear current signature pointer in people table (does not delete old historical objects)
  const { error } = await db
    .from("people")
    .update({
      signature_path: null,
      updated_at: new Date().toISOString(),
    })
    .eq("login_id", session.login_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
