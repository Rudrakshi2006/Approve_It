import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSession } from "@/lib/auth";
import { SESSION_COOKIE } from "@/lib/session";
import { getDb } from "@/lib/db";
import { getApplicationById } from "@/lib/repos/applications";

const EditApplicationSchema = z.object({
  subject: z.string().min(3).max(200).optional(),
  comment: z.string().max(2000).optional().nullable(),
});

/**
 * Allows applicant to edit application details ONLY while returned (Test A8).
 * Editing while 'in_review' is strictly rejected with 409 Conflict.
 */
export async function PATCH(
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

  // Only the applicant can edit
  if (app.applicant_login_id !== session.login_id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Test A8: Student CANNOT edit while in_review (only while 'returned')
  if (app.status !== "returned") {
    return NextResponse.json(
      {
        error: `Cannot edit application while status is '${app.status}'. Modifications are only allowed when returned.`,
      },
      { status: 409 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = EditApplicationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Validation failed" },
      { status: 422 }
    );
  }

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (parsed.data.subject) {
    updates.subject = parsed.data.subject.trim();
  }

  if (parsed.data.comment !== undefined) {
    updates.payload = {
      ...(app.payload || {}),
      comment: parsed.data.comment?.trim() || "",
    };
  }

  const db = getDb();
  const { data: updated, error: updateErr } = await db
    .from("applications")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (updateErr || !updated) {
    return NextResponse.json(
      { error: `Update failed: ${updateErr?.message || "Unknown error"}` },
      { status: 500 }
    );
  }

  return NextResponse.json(updated);
}
