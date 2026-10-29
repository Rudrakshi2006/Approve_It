import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSession } from "@/lib/auth";
import { SESSION_COOKIE } from "@/lib/session";
import { getDb } from "@/lib/db";
import { getApplicationById } from "@/lib/repos/applications";

const WithdrawSchema = z.object({
  reason: z.string().max(1000).optional().nullable(),
});

/**
 * Withdraw application (Test A10).
 * Allowed only while in_review or returned.
 * Blocked after approved, rejected, or already cancelled (409 Conflict).
 */
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

  // 1. Applicant only
  if (app.applicant_login_id !== session.login_id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 2. Allowed ONLY while in_review or returned (Test A10)
  if (app.status !== "in_review" && app.status !== "returned") {
    return NextResponse.json(
      {
        error: `Cannot withdraw application with status '${app.status}'. Withdrawal is only allowed while in_review or returned.`,
      },
      { status: 409 }
    );
  }

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    // Body is optional
  }

  const parsed = WithdrawSchema.safeParse(body);
  const reason = parsed.success && parsed.data.reason ? parsed.data.reason.trim() : null;

  const db = getDb();

  // 3. Optimistic update: status -> cancelled
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

  return NextResponse.json({ ok: true, status: "cancelled" });
}
