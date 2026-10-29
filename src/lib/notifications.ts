import "server-only";
import { getDb } from "./db";

export type NotificationKind =
  | "submitted"
  | "resubmitted"
  | "forwarded"
  | "approved"
  | "rejected"
  | "returned"
  | "withdrawn"
  | "comment";

export interface CreateNotificationParams {
  recipient_login_id: string;
  application_id: string;
  kind: NotificationKind;
  message: string;
}

export async function createNotification(
  params: CreateNotificationParams
): Promise<void> {
  const db = getDb();
  const { error } = await db.from("notifications").insert({
    recipient_login_id: params.recipient_login_id,
    application_id: params.application_id,
    kind: params.kind,
    message: params.message,
    read_at: null,
  });

  if (error) {
    console.error("Failed to insert notification:", error.message);
  }
}

export async function createNotificationsBatch(
  list: CreateNotificationParams[]
): Promise<void> {
  if (list.length === 0) return;
  const db = getDb();
  const { error } = await db.from("notifications").insert(
    list.map((n) => ({
      recipient_login_id: n.recipient_login_id,
      application_id: n.application_id,
      kind: n.kind,
      message: n.message,
      read_at: null,
    }))
  );

  if (error) {
    console.error("Failed to insert batch notifications:", error.message);
  }
}

export async function getUnreadNotificationCount(
  loginId: string
): Promise<number> {
  const db = getDb();
  const { count, error } = await db
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("recipient_login_id", loginId)
    .is("read_at", null);

  if (error || typeof count !== "number") {
    return 0;
  }
  return count;
}
