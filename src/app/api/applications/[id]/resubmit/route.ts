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
import { createNotification } from "@/lib/notifications";

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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const parseResult = ResubmitSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: parseResult.error.issues[0]?.message || "Validation failed" },
      { status: 422 }
    );
  }

  const { comment } = parseResult.data;

  // 1. Fetch application details
  const app = await getApplicationById(id);
  if (!app) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  // 2. Only applicant can resubmit
  if (app.applicant_login_id !== session.login_id) {
    return NextResponse.json(
      { error: "Forbidden: Only the original applicant can resubmit this application" },
      { status: 403 }
    );
  }

  // 3. Application MUST be in status 'returned' (hold)
  if (app.status !== "returned") {
    return NextResponse.json(
      { error: `Cannot resubmit application with status '${app.status}' (must be 'returned')` },
      { status: 409 }
    );
  }

  const db = getDb();
  const currentStepConfig = app.chain_snapshot[app.current_step];

  // Resolve approver for this returned step
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

  let assignedApprover: string | null = null;
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
    const msg = err instanceof Error ? err.message : "Failed to resolve approver";
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

  // 6. Notify the designated approver
  if (assignedApprover) {
    const urgentPrefix = app.urgent ? "⚡ URGENT: " : "";
    await createNotification({
      recipient_login_id: assignedApprover,
      application_id: app.id,
      kind: "resubmitted",
      message: `${urgentPrefix}Application "${app.subject}" was revised and resubmitted by ${session.name}`,
    });
  }

  return NextResponse.json({ ok: true, status: "in_review", current_step: app.current_step });
}
