import type { ApprovalChain } from "../workflow/chains";

export interface ApplicantSnapshot {
  name: string;
  login_id: string;
  email?: string | null;
  department: string;
  batch?: string | null;
  section?: string | null;
  semester?: number | null;
  designation?: string | null;
  saturday_group?: string | null;
  role?: string | null;
}

export interface ApplicationRecord {
  id: string;
  type: string;
  subject: string;
  applicant_login_id: string;
  applicant_snapshot: ApplicantSnapshot;
  class_teacher_login_id?: string | null;
  payload: Record<string, unknown>;
  status: "draft" | "in_review" | "approved" | "rejected" | "returned" | "cancelled";
  current_step: number;
  current_approver_login_id?: string | null;
  chain_snapshot: ApprovalChain;
  urgent: boolean;
  created_at: string;
  updated_at: string;
}

export interface ApplicationStepRecord {
  id: number;
  application_id: string;
  step_index: number;
  step_key: string;
  actor_login_id: string;
  decision: "submitted" | "resubmitted" | "approved" | "rejected" | "returned" | "forwarded" | "withdrawn";
  comment?: string | null;
  verification_id?: string | null;
  signature_path?: string | null;
  at: string;
}

export interface AttachmentRecord {
  id: string;
  application_id: string;
  uploaded_by: string;
  message_id?: number | null;
  storage_path: string;
  original_name: string;
  mime: string;
  size_bytes: number;
  created_at: string;
  removed_at?: string | null;
}

export interface ApplicationDetail extends ApplicationRecord {
  steps: ApplicationStepRecord[];
  attachments: AttachmentRecord[];
  current_approver?: {
    name: string;
    login_id: string;
  } | null;
}

export interface ExecuteTransitionParams {
  application_id: string;
  expected_current_step: number;
  expected_current_approver: string;
  new_status: string;
  new_step: number;
  new_approver?: string | null;
  step_key: string;
  decision: string;
  comment?: string | null;
  verification_id?: string | null;
  signature_path?: string | null;
}
