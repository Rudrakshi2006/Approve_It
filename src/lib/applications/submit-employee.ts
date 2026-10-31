import { getDb } from "@/lib/db";
import { createAndSubmitApplication } from "@/lib/repos/applications";
import { parseChain } from "@/lib/workflow/chains";
import {
  resolveApprover,
  type ApproverResolutionContext,
} from "@/lib/workflow/resolve-approver";
import { createNotification } from "@/lib/notifications";
import { parseDDMMYYYYtoISO, getTodayIST } from "@/lib/dates";
import { previewLeave } from "@/lib/leave/service";
import type { ApplicantSnapshot } from "@/lib/repos/types";
import type { Session } from "@/lib/session";
import type { LeaveType } from "@/lib/leave/types";

export interface SubmitEmployeeGeneralInput {
  category: string;
  subject: string;
  description: string;
  from_date?: string | null;
  to_date?: string | null;
  comment?: string | null;
  urgent?: boolean;
  attachments?: Array<{
    storage_path: string;
    original_name: string;
    size_bytes: number;
    mime: string;
  }>;
}

export interface SubmitEmployeeLeaveInput {
  leave_type: LeaveType;
  from_date: string;
  to_date?: string | null;
  reason: string;
  comment?: string | null;
  attachments?: Array<{
    storage_path: string;
    original_name: string;
    size_bytes: number;
    mime: string;
  }>;
}

function normalizeDate(d: string): string | null {
  if (/^\d{2}-\d{2}-\d{4}$/.test(d)) {
    return parseDDMMYYYYtoISO(d);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
    return d;
  }
  return null;
}

export async function submitEmployeeGeneral(
  session: Session,
  input: SubmitEmployeeGeneralInput
): Promise<{ ok: true; id: string } | { ok: false; error: string; status: number }> {
  if (session.eklink_role === "student") {
    return { ok: false, error: "Students cannot submit employee applications", status: 403 };
  }

  const db = getDb();
  const isHod = session.eklink_role === "hod";
  const appType = isHod ? "hod_general" : "employee_general";

  // 1. Fetch chain configuration
  const { data: typeData, error: typeErr } = await db
    .from("application_types")
    .select("name, enabled, chain")
    .eq("key", appType)
    .maybeSingle();

  if (typeErr || !typeData) {
    return { ok: false, error: `Application type '${appType}' is not configured`, status: 404 };
  }

  if (!typeData.enabled) {
    return {
      ok: false,
      error: `Applications for '${typeData.name}' are currently paused by administration`,
      status: 403,
    };
  }

  const chain = parseChain(typeData.chain);
  const firstStep = chain[0];
  if (!firstStep) {
    return { ok: false, error: "Workflow chain has no steps configured", status: 500 };
  }

  // 2. Fetch full person details for snapshot
  let person: any = null;
  try {
    const { data } = await db
      .from("people")
      .select("login_id, name, department, designation, eklink_role, saturday_group")
      .eq("login_id", session.login_id)
      .maybeSingle();
    person = data;
  } catch {
    const { data } = await db
      .from("people")
      .select("login_id, name, department, designation, eklink_role")
      .eq("login_id", session.login_id)
      .maybeSingle();
    person = data;
  }

  const applicantDepartment = person?.department || session.department || "General";
  const applicantSnapshot: ApplicantSnapshot = {
    login_id: session.login_id,
    name: person?.name || session.name,
    department: applicantDepartment,
    batch: "",
    semester: 0,
    section: "",
    designation: person?.designation || (isHod ? "Head of Department" : "Faculty/Staff"),
    saturday_group: person?.saturday_group || "odd",
    role: person?.eklink_role || session.eklink_role,
  };

  // 3. Resolve Step 0 approver
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
    async findAssignedApprover(applicationType: string, stepKey: string, scopeKey?: string | null) {
      let query = db
        .from("approver_assignments")
        .select("approver_login_id")
        .eq("application_type", applicationType)
        .eq("step_key", stepKey);

      if (scopeKey) {
        query = query.eq("scope_key", scopeKey);
      }

      const { data } = await query.maybeSingle();
      return data?.approver_login_id ?? null;
    },
  };

  let initialApprover: string;
  try {
    initialApprover = await resolveApprover(
      firstStep.resolver,
      {
        applicationType: appType,
        stepKey: firstStep.step_key,
        applicantDepartment,
      },
      resolutionContext
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to resolve initial approver";
    return { ok: false, error: msg, status: 422 };
  }

  // 4. Create and submit
  const payload: Record<string, unknown> = {
    category: input.category,
    description: input.description,
    from_date: input.from_date || null,
    to_date: input.to_date || input.from_date || null,
    comment: input.comment || input.description,
  };

  const app = await createAndSubmitApplication({
    type: appType,
    subject: input.subject,
    applicant_login_id: session.login_id,
    applicant_snapshot: applicantSnapshot,
    payload,
    urgent: input.urgent ?? false,
    chain_snapshot: chain,
    initial_approver_login_id: initialApprover,
  });

  // 5. Attachments if any
  if (input.attachments && input.attachments.length > 0) {
    const attachmentRows = input.attachments.map((att) => ({
      application_id: app.id,
      storage_path: att.storage_path,
      original_name: att.original_name,
      size_bytes: att.size_bytes,
      mime: att.mime,
      uploaded_by: session.login_id,
      active: true,
    }));
    await db.from("attachments").insert(attachmentRows);
  }

  // 6. Notify initial approver
  await createNotification({
    recipient_login_id: initialApprover,
    application_id: app.id,
    kind: "submitted",
    message: `New ${appType === "hod_general" ? "HOD" : "Employee"} general application: "${input.subject}" from ${session.name}`,
  });

  return { ok: true, id: app.id };
}

export async function submitEmployeeLeave(
  session: Session,
  input: SubmitEmployeeLeaveInput
): Promise<
  | { ok: true; id: string; working_days: number; unpaid_days: number }
  | { ok: false; error: string; status: number }
> {
  if (session.eklink_role === "student") {
    return { ok: false, error: "Students cannot submit employee leave applications", status: 403 };
  }

  const fromIso = normalizeDate(input.from_date);
  const effectiveToRaw = input.to_date && input.to_date.trim() ? input.to_date.trim() : input.from_date.trim();
  const toIso = normalizeDate(effectiveToRaw);

  if (!fromIso || !toIso) {
    return { ok: false, error: "Invalid date format. Expected DD-MM-YYYY or YYYY-MM-DD", status: 422 };
  }

  const todayIso = getTodayIST();
  if (fromIso < todayIso) {
    return {
      ok: false,
      error: "Past dates are not allowed for leave applications. Please select today or a future date.",
      status: 422,
    };
  }

  if (fromIso > toIso) {
    return { ok: false, error: "Leave From Date cannot be later than To Date", status: 422 };
  }

  const db = getDb();
  const isHod = session.eklink_role === "hod";
  const appType = isHod ? "hod_leave" : "employee_leave";

  // 1. Fetch chain configuration
  const { data: typeData, error: typeErr } = await db
    .from("application_types")
    .select("name, enabled, chain")
    .eq("key", appType)
    .maybeSingle();

  if (typeErr || !typeData) {
    return { ok: false, error: `Application type '${appType}' is not configured`, status: 404 };
  }

  if (!typeData.enabled) {
    return {
      ok: false,
      error: `Applications for '${typeData.name}' are currently paused by administration`,
      status: 403,
    };
  }

  const chain = parseChain(typeData.chain);
  const firstStep = chain[0];
  if (!firstStep) {
    return { ok: false, error: "Workflow chain has no steps configured", status: 500 };
  }

  // 2. Fetch person details for Saturday group & snapshot
  let person: any = null;
  try {
    const { data } = await db
      .from("people")
      .select("login_id, name, department, designation, eklink_role, saturday_group")
      .eq("login_id", session.login_id)
      .maybeSingle();
    person = data;
  } catch {
    const { data } = await db
      .from("people")
      .select("login_id, name, department, designation, eklink_role")
      .eq("login_id", session.login_id)
      .maybeSingle();
    person = data;
  }

  const satGroup = person?.saturday_group === "even" ? "even" : "odd";

  // 3. Server-side validation: calculate working days & check overlap
  const preview = await previewLeave({
    loginId: session.login_id,
    fromDate: fromIso,
    toDate: toIso,
    leaveType: input.leave_type,
    saturdayGroup: satGroup,
  });

  if (preview.hasOverlap) {
    return {
      ok: false,
      error: `Leave dates conflict with an existing active application (ID: ${preview.conflictingApplicationId})`,
      status: 422,
    };
  }

  if (preview.workingDays === 0) {
    return {
      ok: false,
      error: "Selected leave period contains 0 working days (all selected days are off-days or holidays)",
      status: 422,
    };
  }

  const applicantDepartment = person?.department || session.department || "General";
  const applicantSnapshot: ApplicantSnapshot = {
    login_id: session.login_id,
    name: person?.name || session.name,
    department: applicantDepartment,
    batch: "",
    semester: 0,
    section: "",
    designation: person?.designation || (isHod ? "Head of Department" : "Faculty/Staff"),
    saturday_group: satGroup,
    role: person?.eklink_role || session.eklink_role,
  };

  // 4. Resolve Step 0 approver
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
    async findAssignedApprover(applicationType: string, stepKey: string, scopeKey?: string | null) {
      let query = db
        .from("approver_assignments")
        .select("approver_login_id")
        .eq("application_type", applicationType)
        .eq("step_key", stepKey);

      if (scopeKey) {
        query = query.eq("scope_key", scopeKey);
      }

      const { data } = await query.maybeSingle();
      return data?.approver_login_id ?? null;
    },
  };

  let initialApprover: string;
  try {
    initialApprover = await resolveApprover(
      firstStep.resolver,
      {
        applicationType: appType,
        stepKey: firstStep.step_key,
        applicantDepartment,
      },
      resolutionContext
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to resolve initial approver";
    return { ok: false, error: msg, status: 422 };
  }

  // 5. Store payload with working days & projected balance
  const payload = {
    leave_type: input.leave_type,
    from_date: fromIso,
    to_date: toIso,
    reason: input.reason,
    working_days: preview.workingDays,
    total_days: preview.totalDays,
    excluded_days: preview.excludedDays,
    balance_at_submission: preview.currentBalance,
    projected_deducted: preview.deducted,
    projected_unpaid: preview.unpaid,
    projected_balance_after: preview.balanceAfter,
    comment: input.comment || input.reason,
  };

  const dateRangeStr =
    input.from_date === input.to_date
      ? input.from_date
      : `${input.from_date} to ${input.to_date}`;

  const subject = `${input.leave_type === "medical" ? "Medical Leave" : "Personal Leave"} (${dateRangeStr}) - ${preview.workingDays} working ${preview.workingDays === 1 ? "day" : "days"}`;

  const app = await createAndSubmitApplication({
    type: appType,
    subject,
    applicant_login_id: session.login_id,
    applicant_snapshot: applicantSnapshot,
    payload,
    chain_snapshot: chain,
    initial_approver_login_id: initialApprover,
  });

  // 6. Attachments if any
  if (input.attachments && input.attachments.length > 0) {
    const attachmentRows = input.attachments.map((att) => ({
      application_id: app.id,
      storage_path: att.storage_path,
      original_name: att.original_name,
      size_bytes: att.size_bytes,
      mime: att.mime,
      uploaded_by: session.login_id,
      active: true,
    }));
    await db.from("attachments").insert(attachmentRows);
  }

  // 7. Notify initial approver
  await createNotification({
    recipient_login_id: initialApprover,
    application_id: app.id,
    kind: "submitted",
    message: `New leave application: "${subject}" from ${session.name} (${preview.workingDays} working ${preview.workingDays === 1 ? "day" : "days"})`,
  });

  return {
    ok: true,
    id: app.id,
    working_days: preview.workingDays,
    unpaid_days: preview.unpaid,
  };
}
