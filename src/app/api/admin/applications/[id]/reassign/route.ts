import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSyncAdmin } from "@/lib/auth";
import { SESSION_COOKIE } from "@/lib/session";
import { getDb } from "@/lib/db";
import { createNotification } from "@/lib/notifications";

const ReassignSchema = z.object({
  new_approver_login_id: z.string().trim().min(1, "New approver login ID is required"),
  reason: z.string().trim().max(1000).optional().nullable(),
});

/**
 * Admin reassignment of the CURRENT step of an open application (e.g. its approver was
 * deactivated in EkLink). Uses an optimistic check on the current approver, and records the
 * change in the application thread (application_steps is append-only with a fixed decision set).
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiSyncAdmin(request.cookies.get(SESSION_COOKIE)?.value);
  if (auth.errorResponse) return auth.errorResponse;
  const { session } = auth;
  const { id } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = ReassignSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Validation failed" },
      { status: 422 }
    );
  }
  const newApprover = parsed.data.new_approver_login_id;
  const reason = parsed.data.reason || "";

  const db = getDb();
  const { data: app, error: appErr } = await db
    .from("applications")
    .select("id, subject, status, current_approver_login_id, applicant_login_id, urgent")
    .eq("id", id)
    .maybeSingle();
  if (appErr || !app) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }
  if (app.status !== "in_review") {
    return NextResponse.json(
      { error: `Only applications in review can be reassigned (status: ${app.status})` },
      { status: 409 }
    );
  }
  const oldApprover = app.current_approver_login_id as string | null;
  if (oldApprover === newApprover) {
    return NextResponse.json({ error: "That person is already the current approver" }, { status: 422 });
  }

  const { data: person } = await db
    .from("people")
    .select("login_id, name, is_active")
    .eq("login_id", newApprover)
    .maybeSingle();
  if (!person) {
    return NextResponse.json({ error: `No person with login ID ${newApprover}` }, { status: 422 });
  }
  if ((person as { is_active?: boolean }).is_active === false) {
    return NextResponse.json({ error: `${newApprover} is deactivated` }, { status: 422 });
  }

  let update = db
    .from("applications")
    .update({ current_approver_login_id: newApprover, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "in_review");
  update = oldApprover ? update.eq("current_approver_login_id", oldApprover) : update.is("current_approver_login_id", null);
  const { data: updated, error: updErr } = await update.select("id").maybeSingle();
  if (updErr || !updated) {
    return NextResponse.json(
      { error: "Conflict: the application changed meanwhile, reload and try again" },
      { status: 409 }
    );
  }

  const note =
    `Reassigned by administrator ${session.name} (${session.login_id}): current approver ` +
    `${oldApprover ?? "none"} -> ${person.name} (${newApprover}).` +
    (reason ? ` Reason: ${reason}` : "");
  const { error: msgErr } = await db.from("application_messages").insert({
    application_id: id,
    author_login_id: session.login_id,
    body: note,
  });
  if (msgErr) {
    console.error("[admin reassign] could not record thread message:", msgErr.message);
  }

  await createNotification({
    recipient_login_id: newApprover,
    application_id: id,
    kind: "forwarded",
    message: `${app.urgent ? "⚡ URGENT: " : ""}Application "${app.subject}" was reassigned to you by an administrator`,
  });

  return NextResponse.json({ ok: true, id, previous_approver: oldApprover, current_approver: newApprover });
}
