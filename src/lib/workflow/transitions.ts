import type { ApprovalChain, StepConfig } from "./chains";

export type ApproverAction = "approve" | "reject" | "return";

export interface ApplicationState {
  id: string;
  status: string;
  current_step: number;
  current_approver_login_id?: string | null;
}

export interface TransitionSuccess {
  ok: true;
  new_status: "in_review" | "approved" | "rejected" | "returned";
  new_step: number;
  next_step_config: StepConfig | null;
  needs_approver_resolution: boolean;
  decision: "approved" | "rejected" | "returned";
  comment: string | null;
}

export type TransitionErrorCode =
  | "APPLICATION_NOT_IN_REVIEW"
  | "ACTOR_NOT_CURRENT_APPROVER"
  | "STEP_INDEX_OUT_OF_BOUNDS"
  | "STEP_CANNOT_REJECT"
  | "STEP_CANNOT_RETURN"
  | "COMMENT_REQUIRED_ON_REJECT"
  | "COMMENT_REQUIRED_ON_RETURN"
  | "INVALID_ACTION";

export interface TransitionFailure {
  ok: false;
  code: TransitionErrorCode;
  message: string;
  httpStatus: number;
}

export type TransitionResult = TransitionSuccess | TransitionFailure;

/**
 * Pure transition logic for approver actions (approve, reject, return).
 * Enforces:
 * - Application must be in 'in_review'
 * - Actor must be the current approver
 * - Step bounds checking
 * - Reject / Return permissions and mandatory comments (422)
 * - Final step approval moves to 'approved', otherwise advances step
 */
export function calculateTransition(
  application: ApplicationState,
  chain: ApprovalChain,
  actorLoginId: string,
  action: ApproverAction,
  comment?: string | null
): TransitionResult {
  // 1. Enforce application status
  if (application.status !== "in_review") {
    return {
      ok: false,
      code: "APPLICATION_NOT_IN_REVIEW",
      message: `Cannot transition application with status '${application.status}' (must be 'in_review')`,
      httpStatus: 409,
    };
  }

  // 2. Enforce actor is current approver
  if (application.current_approver_login_id !== actorLoginId) {
    return {
      ok: false,
      code: "ACTOR_NOT_CURRENT_APPROVER",
      message: "You are not the designated approver for this step",
      httpStatus: 403,
    };
  }

  // 3. Current step configuration
  const currentStepIndex = application.current_step;
  const currentStep = chain[currentStepIndex];
  if (!currentStep) {
    return {
      ok: false,
      code: "STEP_INDEX_OUT_OF_BOUNDS",
      message: `Step index ${currentStepIndex} is out of bounds for chain length ${chain.length}`,
      httpStatus: 422,
    };
  }

  const cleanComment = comment?.trim() || null;

  // 4. Action: REJECT
  if (action === "reject") {
    if (currentStep.can_reject === false) {
      return {
        ok: false,
        code: "STEP_CANNOT_REJECT",
        message: "Rejection is not permitted on this step",
        httpStatus: 422,
      };
    }

    if (!cleanComment) {
      return {
        ok: false,
        code: "COMMENT_REQUIRED_ON_REJECT",
        message: "A comment or reason is required when rejecting an application",
        httpStatus: 422,
      };
    }

    return {
      ok: true,
      new_status: "rejected",
      new_step: currentStepIndex,
      next_step_config: null,
      needs_approver_resolution: false,
      decision: "rejected",
      comment: cleanComment,
    };
  }

  // 5. Action: RETURN (HOLD)
  if (action === "return") {
    if (currentStep.can_return === false) {
      return {
        ok: false,
        code: "STEP_CANNOT_RETURN",
        message: "Returning to student is not permitted on this step",
        httpStatus: 422,
      };
    }

    if (!cleanComment) {
      return {
        ok: false,
        code: "COMMENT_REQUIRED_ON_RETURN",
        message: "A comment explaining what needs correction is required when returning an application",
        httpStatus: 422,
      };
    }

    return {
      ok: true,
      new_status: "returned",
      new_step: currentStepIndex,
      next_step_config: null,
      needs_approver_resolution: false,
      decision: "returned",
      comment: cleanComment,
    };
  }

  // 6. Action: APPROVE
  if (action === "approve") {
    const isLastStep = currentStepIndex >= chain.length - 1;

    if (isLastStep) {
      return {
        ok: true,
        new_status: "approved",
        new_step: currentStepIndex,
        next_step_config: null,
        needs_approver_resolution: false,
        decision: "approved",
        comment: cleanComment,
      };
    }

    const nextIndex = currentStepIndex + 1;
    const nextStep = chain[nextIndex];

    return {
      ok: true,
      new_status: "in_review",
      new_step: nextIndex,
      next_step_config: nextStep,
      needs_approver_resolution: true,
      decision: "approved",
      comment: cleanComment,
    };
  }

  return {
    ok: false,
    code: "INVALID_ACTION",
    message: `Unknown action '${action}'`,
    httpStatus: 400,
  };
}
