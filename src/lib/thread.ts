import type { ApplicationStepRecord, AttachmentRecord } from "./repos/types";

export interface MessageRecord {
  id: number;
  application_id: string;
  author_login_id: string;
  body: string;
  created_at: string;
}

export type TimelineItem =
  | {
      kind: "step";
      id: string;
      at: string;
      actor_login_id: string;
      decision: string;
      comment?: string | null;
      verification_id?: string | null;
      signature_path?: string | null;
      step_key: string;
    }
  | {
      kind: "message";
      id: string;
      at: string;
      author_login_id: string;
      body: string;
    }
  | {
      kind: "attachment";
      id: string;
      at: string;
      uploaded_by: string;
      original_name: string;
      size_bytes: number;
      mime: string;
    };

/**
 * Builds a single unified chronological timeline from steps, messages, and attachments.
 * Items are strictly sorted by date/time ascending.
 */
export function buildUnifiedTimeline(
  steps: ApplicationStepRecord[],
  messages: MessageRecord[] = [],
  attachments: AttachmentRecord[] = []
): TimelineItem[] {
  const items: TimelineItem[] = [];

  // 1. Add steps
  for (const step of steps) {
    items.push({
      kind: "step",
      id: `step-${step.id}`,
      at: step.at,
      actor_login_id: step.actor_login_id,
      decision: step.decision,
      comment: step.comment,
      verification_id: step.verification_id,
      signature_path: step.signature_path,
      step_key: step.step_key,
    });
  }

  // 2. Add messages
  for (const msg of messages) {
    items.push({
      kind: "message",
      id: `msg-${msg.id}`,
      at: msg.created_at,
      author_login_id: msg.author_login_id,
      body: msg.body,
    });
  }

  // 3. Add initial attachments that are not linked to messages
  for (const att of attachments) {
    if (!att.message_id && !att.removed_at) {
      items.push({
        kind: "attachment",
        id: `att-${att.id}`,
        at: att.created_at,
        uploaded_by: att.uploaded_by,
        original_name: att.original_name,
        size_bytes: att.size_bytes,
        mime: att.mime,
      });
    }
  }

  // 4. Sort strictly by timestamp ascending
  return items.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
}
