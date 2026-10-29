import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSession } from "@/lib/auth";
import { SESSION_COOKIE } from "@/lib/session";
import { getDb } from "@/lib/db";
import { getApplicationById } from "@/lib/repos/applications";
import { createNotification } from "@/lib/notifications";

const WithdrawSchema = z.object({
  reason: z.string().max(2000).optional().nullable(),
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const parseResult = WithdrawSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: parseResult.error.issues[0]?.message || "Validation failed" },
      { status: 422 }
    );
  }

  const { reason } = parseResult.data;

  // 1. Fetch application details
  const app = await getApplicationById(id);
  if (!app) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  // 2. Only the original applicant can withdraw (Test A10)
  if (app.applicant_login_id !== session.login_id) {
    return NextResponse.json(
      { error: "Forbidden: Only the applicant can withdraw this application" },
      { status: 403 }
    );
  }

  // 3. Can ONLY withdraw while status is 'in_review' or 'returned' (Test A10)
  if (app.status !== "in_review" && app.status !== "returned") {
    return NextResponse.json(
      { error: `Cannot withdraw application with status '${app.status}' (must be 'in_review' or 'returned')` },
      { status: 409 }
    );
  }

  const db = getDb();

  // Save current approver to notify before clearing
  const prevApprover = app.current_approver_login_id;

  // Update applications status -> cancelled (optimistic lock on status)
  const { data: updated, error: updateErr } = await db
    .from("applications")
    .update({
      status: "cancelled",
      current_approver_login_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", app.id)
    .in("status", ["in_review", "returned"])
    .select()
    .maybeSingle();

  if (updateErr || !updated) {
    return NextResponse.json(
      { error: "Conflict: Application status has changed" },
      { status: 409 }
    );
  }

  // 4. Insert withdrawn step row
  const currentStepConfig = app.chain_snapshot[app.current_step];
  const stepKey = currentStepConfig?.step_key || "withdrawal";

  const { error: stepErr } = await db.from("application_steps").insert({
    application_id: app.id,
    step_index: app.current_step,
    step_key: stepKey,
    actor_login_id: session.login_id,
    decision: "withdrawn",
    comment: reason || "Withdrawn by applicant",
  });

  if (stepErr) {
    return NextResponse.json({ error: stepErr.message }, { status: 500 });
  }

  // 5. Notify the approver whose queue this was in
  if (prevApprover) {
    await createNotification({
      recipient_login_id: prevApprover,
      application_id: app.id,
      kind: "withdrawn",
      message: `Application "${app.subject}" was withdrawn by applicant ${session.name}`,
    });
  }

  return NextResponse.json({ ok: true, status: "cancelled" });
}
