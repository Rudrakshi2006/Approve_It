import { type NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth";
import { SESSION_COOKIE } from "@/lib/session";
import { getDb } from "@/lib/db";

export async function POST(request: NextRequest) {
  const rawCookie = request.cookies.get(SESSION_COOKIE)?.value;
  const auth = await requireApiSession(rawCookie);
  if (auth.errorResponse) return auth.errorResponse;

  const { session } = auth;
  const db = getDb();

  const { error } = await db
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_login_id", session.login_id)
    .is("read_at", null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
