import { getDb } from "@/lib/db";
import { createAndSubmitApplication } from "@/lib/repos/applications";
import { parseChain } from "@/lib/workflow/chains";
import {
  resolveApprover,
  type ApproverResolutionContext,
} from "@/lib/workflow/resolve-approver";
import { calculateSuggestedSemester } from "@/lib/semester";
import type { ApplicantSnapshot } from "@/lib/repos/types";
import type { Session } from "@/lib/session";

export interface SubmitApplicationInput {
  type: string;
  subject: string;
  class_teacher_login_id?: string | null;
  comment?: string | null;
  urgent?: boolean;
  payload?: Record<string, unknown>;
  attachments?: Array<{
    storage_path: string;
    original_name: string;
    size_bytes: number;
    mime: string;
  }>;
}

export async function submitApplication(
  session: Session,
  input: SubmitApplicationInput
): Promise<{ ok: true; id: string } | { ok: false; error: string; status: number }> {
  const db = getDb();

  // 1. Fetch application type & chain config
  const { data: typeData, error: typeErr } = await db
    .from("application_types")
    .select("name, enabled, chain")
    .eq("key", input.type)
    .maybeSingle();

  if (typeErr || !typeData) {
    return { ok: false, error: `Application type '${input.type}' is not configured`, status: 404 };
  }

  if (!typeData.enabled) {
    return {
      ok: false,
      error: `Applications for '${typeData.name}' are currently paused by administration`,
      status: 403,
    };
  }

  const chain = parseChain(typeData.chain);
  const initialStepConfig = chain[0];
  if (!initialStepConfig) {
    return { ok: false, error: "Workflow chain has no steps configured", status: 500 };
  }

  // 2. Validate selected class teacher if initial step requires applicant selection
  if (initialStepConfig.resolver.kind === "applicant_selected") {
    if (!input.class_teacher_login_id) {
      return { ok: false, error: "Please select an approver / faculty member for this request", status: 422 };
    }

    const { data: facultyPerson, error: facErr } = await db
      .from("people")
      .select("login_id, eklink_role")
      .eq("login_id", input.class_teacher_login_id)
      .maybeSingle();

    if (facErr || !facultyPerson || (facultyPerson.eklink_role !== "faculty" && facultyPerson.eklink_role !== "hod")) {
      return { ok: false, error: "Selected approver is invalid or not a faculty member", status: 422 };
    }
  }

  // 3. Approver Resolution Context
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

  let initialApproverLoginId: string;
  try {
    initialApproverLoginId = await resolveApprover(
      initialStepConfig.resolver,
      {
        applicationType: input.type,
        stepKey: initialStepConfig.step_key,
        applicantDepartment: session.department || "CSE",
        selectedApproverLoginId: input.class_teacher_login_id,
      },
      resolutionContext
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to resolve initial approver";
    return { ok: false, error: msg, status: 422 };
  }

  // 4. Build applicant snapshot (frozen at submit time)
  // Fetch current confirmed semester if present in DB
  const { data: personRow } = await db
    .from("people")
    .select("semester")
    .eq("login_id", session.login_id)
    .maybeSingle();

  const semester = personRow?.semester || calculateSuggestedSemester(session.batch || "");

  const applicantSnapshot: ApplicantSnapshot = {
    name: session.name,
    login_id: session.login_id,
    email: session.email,
    department: session.department || "CSE",
    batch: session.batch || null,
    section: session.section || null,
    semester: semester,
  };

  // Only hackathon and re_ca allow urgent per requirements
  const isUrgentAllowed = input.type === "hackathon" || input.type === "re_ca";
  const finalUrgent = isUrgentAllowed ? Boolean(input.urgent) : false;

  // 5. Create application and initial step
  try {
    const payload = {
      ...(input.payload || {}),
      comment: input.comment || input.payload?.comment || "",
    };

    const app = await createAndSubmitApplication({
      type: input.type,
      subject: input.subject,
      applicant_login_id: session.login_id,
      applicant_snapshot: applicantSnapshot,
      class_teacher_login_id: input.class_teacher_login_id ?? null,
      payload,
      urgent: finalUrgent,
      chain_snapshot: chain,
      initial_approver_login_id: initialApproverLoginId,
    });

    // 6. Link attachments if any
    if (input.attachments && input.attachments.length > 0) {
      const rows = input.attachments.map((att) => ({
        application_id: app.id,
        uploaded_by: session.login_id,
        storage_path: att.storage_path,
        original_name: att.original_name,
        size_bytes: att.size_bytes,
        mime: att.mime,
      }));

      const { error: attachErr } = await db.from("attachments").insert(rows);
      if (attachErr) {
        console.error("Failed to insert attachments:", attachErr.message);
      }
    }

    return { ok: true, id: app.id };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Application submission failed";
    return { ok: false, error: msg, status: 500 };
  }
}
