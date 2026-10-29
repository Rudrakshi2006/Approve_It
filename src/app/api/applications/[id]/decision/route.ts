import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSession } from "@/lib/auth";
import { SESSION_COOKIE } from "@/lib/session";
import { getDb } from "@/lib/db";
import {
  executeTransitionInDb,
  getApplicationById,
} from "@/lib/repos/applications";
import { calculateTransition } from "@/lib/workflow/transitions";
import {
  resolveApprover,
  type ApproverResolutionContext,
} from "@/lib/workflow/resolve-approver";
import { generateVerificationId } from "@/lib/stamp/verification-id";

const DecisionSchema = z.object({
  action: z.enum(["approve", "reject", "return"]),
  comment: z.string().max(2000).optional().nullable(),
  include_signature: z.boolean().optional(),
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
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parseResult = DecisionSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: parseResult.error.issues[0]?.message || "Validation failed" },
      { status: 422 }
    );
  }

  const { action, comment, include_signature } = parseResult.data;

  // 1. Fetch application details
  const app = await getApplicationById(id);
  if (!app) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  // 2. Validate current approver
  if (app.current_approver_login_id !== session.login_id) {
    return NextResponse.json(
      { error: "Forbidden: You are not the designated approver for this application" },
      { status: 403 }
    );
  }

  // 3. Compute pure transition logic
  const transition = calculateTransition(
    app,
    app.chain_snapshot,
    session.login_id,
    action,
    comment
  );

  if (!transition.ok) {
    return NextResponse.json(
      { error: transition.message },
      { status: transition.httpStatus }
    );
  }

  const currentStepConfig = app.chain_snapshot[app.current_step];
  let nextApproverLoginId: string | null = null;
  const db = getDb();

  // 4. Resolve next approver if moving to next step
  if (transition.needs_approver_resolution && transition.next_step_config) {
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

    try {
      nextApproverLoginId = await resolveApprover(
        transition.next_step_config.resolver,
        {
          applicationType: app.type,
          stepKey: transition.next_step_config.step_key,
          applicantDepartment: app.applicant_snapshot.department,
          selectedApproverLoginId: app.class_teacher_login_id,
        },
        resolutionContext
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Approver resolution failed";
      return NextResponse.json({ error: msg }, { status: 422 });
    }
  }

  // 5. Generate unique verification ID for this approver decision
  // Stamped with official digital seal for both approve and reject decisions
  const isStamped = action === "approve" || action === "reject";
  const verificationId = isStamped ? generateVerificationId() : null;

  // Retrieve approver signature image from profile if enabled (default true)
  const shouldAttachSignature = include_signature !== false;
  let signaturePath: string | null = null;

  if (isStamped && shouldAttachSignature) {
    const { data: person } = await db
      .from("people")
      .select("signature_path")
      .eq("login_id", session.login_id)
      .maybeSingle();
    signaturePath = person?.signature_path || null;
  }

  // 6. Execute atomic persistence with optimistic lock
  const result = await executeTransitionInDb({
    application_id: app.id,
    expected_current_step: app.current_step,
    expected_current_approver: session.login_id,
    new_status: transition.new_status,
    new_step: transition.new_step,
    new_approver: nextApproverLoginId,
    step_key: currentStepConfig.step_key,
    decision: transition.decision,
    comment: transition.comment,
    verification_id: verificationId,
    signature_path: signaturePath,
  });

  if (!result.success) {
    if (result.error === "conflict_or_not_found") {
      return NextResponse.json(
        { error: "Conflict: This application has already been updated or modified" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: result.error || "Database transition failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    status: transition.new_status,
    verification_id: verificationId,
  });
}
