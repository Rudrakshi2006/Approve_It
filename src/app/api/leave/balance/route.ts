import { type NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth";
import { SESSION_COOKIE } from "@/lib/session";
import { getOrMaterializeLeaveBalances } from "@/lib/leave/service";
import { getDb } from "@/lib/db";

export async function GET(request: NextRequest) {
  const rawCookie = request.cookies.get(SESSION_COOKIE)?.value;
  const auth = await requireApiSession(rawCookie);

  if (auth.errorResponse) {
    return auth.errorResponse;
  }

  const { session } = auth;
  const balances = await getOrMaterializeLeaveBalances(session.login_id);

  const db = getDb();
  const { data: person } = await db
    .from("people")
    .select("saturday_group, designation, department")
    .eq("login_id", session.login_id)
    .maybeSingle();

  return NextResponse.json({
    ok: true,
    medical: balances.medical,
    personal: balances.personal,
    saturday_group: person?.saturday_group || "odd",
    department: person?.department || session.department || "General",
  });
}
