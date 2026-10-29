import { type NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth";
import { SESSION_COOKIE } from "@/lib/session";
import { getDb } from "@/lib/db";
import { createAttachmentSignedUrl } from "@/lib/attachments";

export async function GET(
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

  // Find attachment and its application
  const { data: attachment, error } = await db
    .from("attachments")
    .select("*, applications!inner(applicant_login_id, current_approver_login_id)")
    .eq("id", id)
    .maybeSingle();

  if (error || !attachment) {
    return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
  }

  // Permission check: applicant or approver
  const app = attachment.applications as {
    applicant_login_id: string;
    current_approver_login_id?: string;
  };

  const isApplicant = app.applicant_login_id === session.login_id;
  const isApprover =
    session.eklink_role !== "student"; // Approver role check

  if (!isApplicant && !isApprover) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const signedUrl = await createAttachmentSignedUrl(attachment.storage_path);
  if (!signedUrl) {
    return NextResponse.json({ error: "Failed to generate signed URL" }, { status: 500 });
  }

  return NextResponse.json({ url: signedUrl, original_name: attachment.original_name });
}
