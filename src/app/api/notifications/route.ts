import { type NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth";
import { SESSION_COOKIE } from "@/lib/session";
import { getDb } from "@/lib/db";

export async function GET(request: NextRequest) {
  const rawCookie = request.cookies.get(SESSION_COOKIE)?.value;
  const auth = await requireApiSession(rawCookie);
  if (auth.errorResponse) return auth.errorResponse;

  const { session } = auth;
  const db = getDb();

  const { data, error } = await db
    .from("notifications")
    .select("*")
    .eq("recipient_login_id", session.login_id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ notifications: data || [] });
}
