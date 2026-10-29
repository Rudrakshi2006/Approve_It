import { type NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth";
import { SESSION_COOKIE } from "@/lib/session";
import { getDb } from "@/lib/db";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const rawCookie = request.cookies.get(SESSION_COOKIE)?.value;
  const auth = await requireApiSession(rawCookie);
  if (auth.errorResponse) return auth.errorResponse;

  const { session } = auth;
  const { id } = await context.params;
  const db = getDb();

  // Strict isolation check: user can only mark their OWN notifications; return 404 otherwise
  const { data: notif } = await db
    .from("notifications")
    .select("id, recipient_login_id")
    .eq("id", id)
    .maybeSingle();

  if (!notif || notif.recipient_login_id !== session.login_id) {
    return NextResponse.json({ error: "Notification not found" }, { status: 404 });
  }

  const { error } = await db
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("recipient_login_id", session.login_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id });
}
