import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSession } from "@/lib/auth";
import { SESSION_COOKIE } from "@/lib/session";
import { getDb } from "@/lib/db";
import { getApplicationById } from "@/lib/repos/applications";
import { createNotification } from "@/lib/notifications";

const MessageSchema = z.object({
  body: z
    .string()
    .min(1, "Message cannot be empty")
    .max(2000, "Message cannot exceed 2000 characters"),
});

export async function POST(
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

  const app = await getApplicationById(id);
  if (!app) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  // 1. Thread status check: only allowed while in_review or returned
  if (app.status !== "in_review" && app.status !== "returned") {
    return NextResponse.json(
      { error: `Discussion is closed because application status is '${app.status}'` },
      { status: 409 }
    );
  }

  // 2. Permission check: applicant or involved approver
  const isApplicant = app.applicant_login_id === session.login_id;
  const isCurrentApprover = app.current_approver_login_id === session.login_id;
  const hasParticipated = app.steps.some((s) => s.actor_login_id === session.login_id);

  if (!isApplicant && !isCurrentApprover && !hasParticipated) {
    return NextResponse.json(
      { error: "Forbidden: You are not authorized to post in this thread" },
      { status: 403 }
    );
  }

  let requestBody: unknown;
  try {
    requestBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parseResult = MessageSchema.safeParse(requestBody);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: parseResult.error.issues[0]?.message || "Validation failed" },
      { status: 422 }
    );
  }

  const cleanBody = parseResult.data.body.trim();

  const db = getDb();
  const { data: newMsg, error: insertError } = await db
    .from("application_messages")
    .insert({
      application_id: app.id,
      author_login_id: session.login_id,
      body: cleanBody,
    })
    .select()
    .single();

  if (insertError || !newMsg) {
    return NextResponse.json(
      { error: `Failed to post message: ${insertError?.message || "Unknown error"}` },
      { status: 500 }
    );
  }

  // 3. Notify the other party
  const notifyRecipient = isApplicant ? app.current_approver_login_id : app.applicant_login_id;
  if (notifyRecipient) {
    const preview = cleanBody.length > 60 ? cleanBody.slice(0, 60) + "..." : cleanBody;
    await createNotification({
      recipient_login_id: notifyRecipient,
      application_id: app.id,
      kind: "comment",
      message: `New note on "${app.subject}" from ${session.name}: "${preview}"`,
    });
  }

  return NextResponse.json(newMsg, { status: 201 });
}
