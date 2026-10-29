import { type NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth";
import { SESSION_COOKIE } from "@/lib/session";

export async function GET(request: NextRequest) {
  const rawCookie = request.cookies.get(SESSION_COOKIE)?.value;
  const auth = await requireApiSession(rawCookie);

  if (auth.errorResponse) {
    return auth.errorResponse;
  }

  const { session } = auth;
  return NextResponse.json({
    login_id: session.login_id,
    name: session.name,
    role: session.eklink_role,
  });
}
