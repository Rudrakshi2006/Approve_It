import { type NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth";
import { SESSION_COOKIE } from "@/lib/session";
import { getDb } from "@/lib/db";

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const rawCookie = request.cookies.get(SESSION_COOKIE)?.value;
  const auth = await requireApiSession(rawCookie);

  if (auth.errorResponse) {
    return auth.errorResponse;
  }

  const { session } = auth;
  const { id } = await context.params;

  const db = getDb();

  // Find attachment and application
  const { data: attachment, error } = await db
    .from("attachments")
    .select("*, applications!inner(applicant_login_id, status)")
    .eq("id", id)
    .maybeSingle();

  if (error || !attachment) {
    return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
  }

  const app = attachment.applications as {
    applicant_login_id: string;
    status: string;
  };

  // Only applicant can remove their file
  if (app.applicant_login_id !== session.login_id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Soft remove only permitted when application is returned
  if (app.status !== "returned") {
    return NextResponse.json(
      { error: "Attachments can only be removed while application is returned for correction" },
      { status: 409 }
    );
  }

  // Soft remove (sets removed_at, keeps file in audit history)
  const { error: updateErr } = await db
    .from("attachments")
    .update({ removed_at: new Date().toISOString() })
    .eq("id", id);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
