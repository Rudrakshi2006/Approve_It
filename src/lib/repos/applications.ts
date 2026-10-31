import "server-only";
import { getDb } from "../db";
import type {
  ApplicantSnapshot,
  ApplicationDetail,
  ApplicationRecord,
  AttachmentRecord,
  ExecuteTransitionParams,
} from "./types";
import type { ApprovalChain } from "../workflow/chains";

export interface CreateApplicationParams {
  type: string;
  subject: string;
  applicant_login_id: string;
  applicant_snapshot: ApplicantSnapshot;
  class_teacher_login_id?: string | null;
  payload?: Record<string, unknown>;
  urgent?: boolean;
  chain_snapshot: ApprovalChain;
  initial_approver_login_id: string;
}

export async function createAndSubmitApplication(
  params: CreateApplicationParams
): Promise<ApplicationRecord> {
  const db = getDb();

  // 1. Insert application
  const { data: appData, error: appError } = await db
    .from("applications")
    .insert({
      type: params.type,
      subject: params.subject,
      applicant_login_id: params.applicant_login_id,
      applicant_snapshot: params.applicant_snapshot,
      class_teacher_login_id: params.class_teacher_login_id ?? null,
      payload: params.payload ?? {},
      status: "in_review",
      current_step: 0,
      current_approver_login_id: params.initial_approver_login_id,
      chain_snapshot: params.chain_snapshot,
      urgent: params.urgent ?? false,
    })
    .select()
    .single();

  if (appError || !appData) {
    throw new Error(`Failed to create application: ${appError?.message || "Unknown error"}`);
  }

  // 2. Insert initial submitted step row
  const stepKey = params.chain_snapshot[0]?.step_key || "submission";
  const { error: stepError } = await db.from("application_steps").insert({
    application_id: appData.id,
    step_index: 0,
    step_key: stepKey,
    actor_login_id: params.applicant_login_id,
    decision: "submitted",
    comment: (params.payload?.comment as string) || "Application submitted",
  });

  if (stepError) {
    // If step insert fails, attempt to delete application to preserve consistency
    await db.from("applications").delete().eq("id", appData.id);
    throw new Error(`Failed to create initial application step: ${stepError.message}`);
  }

  return appData as ApplicationRecord;
}

export async function getApplicationById(id: string): Promise<ApplicationDetail | null> {
  const db = getDb();

  const { data: app, error: appError } = await db
    .from("applications")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (appError || !app) {
    return null;
  }

  // Fetch steps in append-only chronological order
  const { data: steps, error: stepsError } = await db
    .from("application_steps")
    .select("*")
    .eq("application_id", id)
    .order("id", { ascending: true });

  if (stepsError) {
    throw new Error(`Failed to fetch application steps: ${stepsError.message}`);
  }

  // Fetch active attachments
  const { data: attachments, error: attachError } = await db
    .from("attachments")
    .select("*")
    .eq("application_id", id)
    .is("removed_at", null)
    .order("created_at", { ascending: true });

  if (attachError) {
    throw new Error(`Failed to fetch attachments: ${attachError.message}`);
  }

  // Optional: fetch current approver details
  let currentApprover: { name: string; login_id: string } | null = null;
  if (app.current_approver_login_id) {
    const { data: approverPerson } = await db
      .from("people")
      .select("login_id, name")
      .eq("login_id", app.current_approver_login_id)
      .maybeSingle();

    if (approverPerson) {
      currentApprover = approverPerson;
    }
  }

  return {
    ...(app as ApplicationRecord),
    steps: steps || [],
    attachments: (attachments || []) as AttachmentRecord[],
    current_approver: currentApprover,
  };
}

export async function listApplicationsByApplicant(
  applicantLoginId: string
): Promise<ApplicationRecord[]> {
  const db = getDb();

  const { data, error } = await db
    .from("applications")
    .select("*")
    .eq("applicant_login_id", applicantLoginId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to list applicant applications: ${error.message}`);
  }

  return (data || []) as ApplicationRecord[];
}

export async function listInboxForApprover(
  approverLoginId: string,
  tab: "pending" | "approved" | "rejected" | "returned" = "pending"
): Promise<ApplicationRecord[]> {
  const db = getDb();

  if (tab === "pending") {
    // Current approver and status in_review (urgent first, then oldest first)
    const { data, error } = await db
      .from("applications")
      .select("*")
      .eq("current_approver_login_id", approverLoginId)
      .eq("status", "in_review")
      .order("urgent", { ascending: false })
      .order("created_at", { ascending: true });

    if (error) {
      throw new Error(`Failed to list pending inbox: ${error.message}`);
    }
    return (data || []) as ApplicationRecord[];
  }

  // For historical tabs: find application IDs where this approver acted
  let query = db
    .from("application_steps")
    .select("application_id")
    .eq("actor_login_id", approverLoginId);

  if (tab === "approved") {
    // Includes both final approvals ('approved') and verified/forwarded intermediate actions ('forwarded')
    query = query.in("decision", ["approved", "forwarded"]);
  } else if (tab === "rejected") {
    query = query.eq("decision", "rejected");
  } else if (tab === "returned") {
    query = query.eq("decision", "returned");
  }

  const { data: stepRows, error: stepErr } = await query.order("at", { ascending: false });

  if (stepErr || !stepRows || stepRows.length === 0) {
    return [];
  }

  const appIds = Array.from(new Set(stepRows.map((r: { application_id: string }) => r.application_id)));

  const { data, error } = await db
    .from("applications")
    .select("*")
    .in("id", appIds)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to list inbox applications: ${error.message}`);
  }

  return (data || []) as ApplicationRecord[];
}

export async function executeTransitionInDb(
  params: ExecuteTransitionParams
): Promise<{ success: boolean; error?: string }> {
  const db = getDb();

  // Try Postgres RPC for atomic execution
  const { data, error } = await db.rpc("execute_application_transition", {
    p_application_id: params.application_id,
    p_expected_current_step: params.expected_current_step,
    p_expected_current_approver: params.expected_current_approver,
    p_new_status: params.new_status,
    p_new_step: params.new_step,
    p_new_approver: params.new_approver ?? null,
    p_step_key: params.step_key,
    p_decision: params.decision,
    p_comment: params.comment ?? null,
    p_verification_id: params.verification_id ?? null,
    p_signature_path: params.signature_path ?? null,
  });

  if (!error && data) {
    const res = data as { success?: boolean; error?: string };
    if (res.success) {
      return { success: true };
    }
    return { success: false, error: res.error || "Transition failed" };
  }

  // Fallback if RPC is not deployed yet: optimistic lock update + step insert
  const { data: updatedApp, error: updateErr } = await db
    .from("applications")
    .update({
      status: params.new_status,
      current_step: params.new_step,
      current_approver_login_id: params.new_approver ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.application_id)
    .eq("status", "in_review")
    .eq("current_step", params.expected_current_step)
    .eq("current_approver_login_id", params.expected_current_approver)
    .select()
    .maybeSingle();

  if (updateErr || !updatedApp) {
    return { success: false, error: "conflict_or_not_found" };
  }

  const { error: insertStepErr } = await db.from("application_steps").insert({
    application_id: params.application_id,
    step_index: params.expected_current_step,
    step_key: params.step_key,
    actor_login_id: params.expected_current_approver,
    decision: params.decision,
    comment: params.comment ?? null,
    verification_id: params.verification_id ?? null,
    signature_path: params.signature_path ?? null,
  });

  if (insertStepErr) {
    return { success: false, error: insertStepErr.message };
  }

  return { success: true };
}

export async function getFacultyList(): Promise<
  { login_id: string; name: string; department: string }[]
> {
  const db = getDb();
  const { data, error } = await db
    .from("people")
    .select("login_id, name, department")
    .eq("eklink_role", "faculty")
    .order("name", { ascending: true });

  if (error || !data) {
    return [];
  }

  return data as { login_id: string; name: string; department: string }[];
}
