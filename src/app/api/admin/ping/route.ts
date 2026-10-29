import { type NextRequest, NextResponse } from "next/server";
import { getAppRoles, requireApiSession } from "@/lib/auth";
import { SESSION_COOKIE } from "@/lib/session";

export async function GET(request: NextRequest) {
  const rawCookie = request.cookies.get(SESSION_COOKIE)?.value;
  const auth = await requireApiSession(rawCookie);

  if (auth.errorResponse) {
    return auth.errorResponse;
  }

  const { session } = auth;
  const roles = await getAppRoles(session.login_id);

  if (!roles.includes("workflow_admin")) {
    return NextResponse.json(
      { error: "forbidden", message: "workflow_admin designation required" },
      { status: 403 }
    );
  }

  return NextResponse.json({
    ok: true,
    message: "pong",
    admin: session.login_id,
  });
}
