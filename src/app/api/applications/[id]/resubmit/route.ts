import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSession } from "@/lib/auth";
import { SESSION_COOKIE } from "@/lib/session";
import { getDb } from "@/lib/db";
import { getApplicationById } from "@/lib/repos/applications";
import {
  resolveApprover,
  type ApproverResolutionContext,
} from "@/lib/workflow/resolve-approver";

const ResubmitSchema = z.object({
  comment: z.string().max(2000).optional().nullable(),
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

  // 1. Applicant only
  if (app.applicant_login_id !== session.login_id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 2. Allowed ONLY while returned (Test A9)
  if (app.status !== "returned") {
    return NextResponse.json(
      { error: `Cannot resubmit application with status '${app.status}' (must be 'returned')` },
      { status: 409 }
    );
  }

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    // Body is optional
  }

  const parsed = ResubmitSchema.safeParse(body);
  const comment = parsed.success && parsed.data.comment ? parsed.data.comment.trim() : null;

  // 3. Re-resolve approver for current step
  const currentStepConfig = app.chain_snapshot[app.current_step];
  if (!currentStepConfig) {
    return NextResponse.json({ error: "Invalid workflow step" }, { status: 500 });
  }

  const db = getDb();
  const resolutionContext: ApproverResolutionContext = {
    async findPersonsByRoleAndDept(role: string, department: string) {
      const { data } = await db
        .from("people")
        .select("login_id")
        .eq("eklink_role", role)
        .eq("department", department);
      return (data || []).map((r: { login_id: string }) => r.login_id);
    },
    async findPersonsByRole(role: string) {
      const { data } = await db
        .from("people")
        .select("login_id")
        .eq("eklink_role", role);
      return (data || []).map((r: { login_id: string }) => r.login_id);
    },
    async findPersonsByAppRole(appRole: string) {
      const { data } = await db
        .from("app_roles")
        .select("login_id")
        .eq("app_role", appRole);
      return (data || []).map((r: { login_id: string }) => r.login_id);
    },
    async findAssignedApprover(appType: string, stepKey: string, scopeKey?: string | null) {
      let query = db
        .from("approver_assignments")
        .select("approver_login_id")
        .eq("application_type", appType)
        .eq("step_key", stepKey);

      if (scopeKey) {
        query = query.eq("scope_key", scopeKey);
      }

      const { data } = await query.maybeSingle();
      return data?.approver_login_id ?? null;
    },
  };

  let assignedApprover: string;
  try {
    assignedApprover = await resolveApprover(
      currentStepConfig.resolver,
      {
        applicationType: app.type,
        stepKey: currentStepConfig.step_key,
        applicantDepartment: app.applicant_snapshot.department,
        selectedApproverLoginId: app.class_teacher_login_id,
      },
      resolutionContext
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Approver resolution failed";
    return NextResponse.json({ error: msg }, { status: 422 });
  }

  // 4. Atomic update: applications status -> in_review + insert step row
  const { data: updatedApp, error: updateErr } = await db
    .from("applications")
    .update({
      status: "in_review",
      current_approver_login_id: assignedApprover,
      updated_at: new Date().toISOString(),
    })
    .eq("id", app.id)
    .eq("status", "returned")
    .select()
    .maybeSingle();

  if (updateErr || !updatedApp) {
    return NextResponse.json(
      { error: "Conflict: Application status has changed" },
      { status: 409 }
    );
  }

  // 5. Insert resubmitted step row (Test A9)
  const { error: stepErr } = await db.from("application_steps").insert({
    application_id: app.id,
    step_index: app.current_step,
    step_key: currentStepConfig.step_key,
    actor_login_id: session.login_id,
    decision: "resubmitted",
    comment: comment || "Resubmitted after correction",
  });

  if (stepErr) {
    return NextResponse.json({ error: stepErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, status: "in_review", current_step: app.current_step });
}
