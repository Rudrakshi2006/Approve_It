import type { StepResolver } from "./chains";

export interface ApproverResolutionContext {
  findPersonsByRoleAndDept(role: string, department: string): Promise<string[]>;
  findPersonsByRole(role: string): Promise<string[]>;
  findPersonsByAppRole(appRole: string): Promise<string[]>;
  findAssignedApprover(
    appType: string,
    stepKey: string,
    scopeKey?: string | null
  ): Promise<string | null>;
}

export interface ApplicationResolutionTarget {
  applicationType: string;
  stepKey: string;
  applicantDepartment: string;
  selectedApproverLoginId?: string | null;
  scopeKey?: string | null;
}

export class ApproverResolutionError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = "ApproverResolutionError";
  }
}

/**
 * Resolves the approver login_id for a given step resolver using the provided context.
 * Strict: Throws ApproverResolutionError with clear, actionable message if 0 or multiple approvers are found.
 */
export async function resolveApprover(
  resolver: StepResolver,
  target: ApplicationResolutionTarget,
  ctx: ApproverResolutionContext
): Promise<string> {
  switch (resolver.kind) {
    case "applicant_selected": {
      if (!target.selectedApproverLoginId) {
        throw new ApproverResolutionError(
          "No approver selected by applicant for this step",
          "MISSING_APPLICANT_SELECTED_APPROVER"
        );
      }
      return target.selectedApproverLoginId;
    }

    case "role_same_department": {
      if (!target.applicantDepartment) {
        throw new ApproverResolutionError(
          "Applicant department is required to resolve department-level approver",
          "MISSING_APPLICANT_DEPARTMENT"
        );
      }
      const candidates = await ctx.findPersonsByRoleAndDept(
        resolver.role,
        target.applicantDepartment
      );

      if (candidates.length === 0) {
        throw new ApproverResolutionError(
          `No ${resolver.role.toUpperCase()} configured for department ${target.applicantDepartment}, contact admin`,
          "NO_DEPT_APPROVER_CONFIGURED"
        );
      }

      if (candidates.length > 1) {
        throw new ApproverResolutionError(
          `Multiple people with role ${resolver.role} found for department ${target.applicantDepartment}, contact admin`,
          "MULTIPLE_DEPT_APPROVERS_CONFIGURED"
        );
      }

      return candidates[0];
    }

    case "role": {
      const candidates = await ctx.findPersonsByRole(resolver.role);

      if (candidates.length === 0) {
        throw new ApproverResolutionError(
          `No person configured with role ${resolver.role}, contact admin`,
          "NO_ROLE_APPROVER_CONFIGURED"
        );
      }

      if (candidates.length > 1) {
        throw new ApproverResolutionError(
          `Multiple people found with role ${resolver.role}, contact admin`,
          "MULTIPLE_ROLE_APPROVERS_CONFIGURED"
        );
      }

      return candidates[0];
    }

    case "app_role": {
      const candidates = await ctx.findPersonsByAppRole(resolver.app_role);

      if (candidates.length === 0) {
        throw new ApproverResolutionError(
          `No person configured with app designation ${resolver.app_role}, contact admin`,
          "NO_APP_ROLE_APPROVER_CONFIGURED"
        );
      }

      if (candidates.length > 1) {
        throw new ApproverResolutionError(
          `Multiple people found with app designation ${resolver.app_role}, contact admin`,
          "MULTIPLE_APP_ROLE_APPROVERS_CONFIGURED"
        );
      }

      return candidates[0];
    }

    case "assignment": {
      const assigned = await ctx.findAssignedApprover(
        target.applicationType,
        target.stepKey,
        target.scopeKey ?? null
      );

      if (!assigned) {
        throw new ApproverResolutionError(
          `No approver assignment configured for ${target.applicationType}`,
          "NO_ASSIGNED_APPROVER"
        );
      }

      return assigned;
    }
  }
}
