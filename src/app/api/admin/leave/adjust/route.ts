import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminSession } from "@/lib/auth";
import { SESSION_COOKIE } from "@/lib/session";
import { getDb } from "@/lib/db";
import { getOrMaterializeLeaveBalances } from "@/lib/leave/service";
import { getTodayIST } from "@/lib/dates";

const AdjustSchema = z.object({
  login_id: z.string().min(1),
  leave_type: z.enum(["medical", "personal"]),
  change_days: z.number().refine((val) => val !== 0, "Change amount cannot be 0"),
  note: z.string().min(3, "Audit note is mandatory for adjustments"),
});

export async function POST(request: NextRequest) {
  const rawCookie = request.cookies.get(SESSION_COOKIE)?.value;
  const auth = await requireAdminSession(rawCookie);

  if (auth.errorResponse) {
    return auth.errorResponse;
  }

  const { session } = auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parseResult = AdjustSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: parseResult.error.issues[0]?.message || "Validation failed" },
      { status: 422 }
    );
  }

  const { login_id, leave_type, change_days, note } = parseResult.data;

  const db = getDb();

  // Verify person exists
  const { data: person, error: pErr } = await db
    .from("people")
    .select("login_id, name")
    .eq("login_id", login_id)
    .maybeSingle();

  if (pErr || !person) {
    return NextResponse.json({ error: `Person with ID '${login_id}' not found` }, { status: 404 });
  }

  // Get current balance
  const balances = await getOrMaterializeLeaveBalances(login_id);
  const curBal = balances[leave_type];

  // Fetch cap
  const { data: capSetting } = await db
    .from("app_settings")
    .select("value")
    .eq("key", "leave_cap_per_type")
    .maybeSingle();

  const cap = typeof capSetting?.value === "number" ? capSetting.value : 12;
  const balanceAfter = Math.max(0, Math.min(cap, curBal + change_days));
  const todayIST = getTodayIST();
  const currentPeriod = todayIST.slice(0, 7);

  const { error: insErr } = await db.from("leave_ledger").insert({
    login_id,
    leave_type,
    kind: "adjustment",
    period: currentPeriod,
    days: Math.abs(change_days),
    unpaid_days: 0,
    balance_before: curBal,
    balance_after: balanceAfter,
    note: `Admin adjustment by ${session.name} (${session.login_id}): ${note}`,
    created_by: session.login_id,
  });

  if (insErr) {
    return NextResponse.json({ error: `Ledger insert failed: ${insErr.message}` }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    login_id,
    leave_type,
    balance_before: curBal,
    balance_after: balanceAfter,
  });
}
