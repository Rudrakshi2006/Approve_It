import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSession } from "@/lib/auth";
import { SESSION_COOKIE } from "@/lib/session";
import { previewLeave } from "@/lib/leave/service";
import { parseDDMMYYYYtoISO } from "@/lib/dates";

const PreviewSchema = z.object({
  from_date: z.string().min(1),
  to_date: z.string().min(1),
  leave_type: z.enum(["medical", "personal"]),
  saturday_group: z.enum(["odd", "even"]).optional(),
});

export async function POST(request: NextRequest) {
  const rawCookie = request.cookies.get(SESSION_COOKIE)?.value;
  const auth = await requireApiSession(rawCookie);

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

  const parseResult = PreviewSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: parseResult.error.issues[0]?.message || "Validation failed" },
      { status: 422 }
    );
  }

  const { from_date, to_date, leave_type, saturday_group } = parseResult.data;

  // Normalize dates
  const fromIso = /^\d{2}-\d{2}-\d{4}$/.test(from_date)
    ? parseDDMMYYYYtoISO(from_date)
    : from_date;
  const toIso = /^\d{2}-\d{2}-\d{4}$/.test(to_date)
    ? parseDDMMYYYYtoISO(to_date)
    : to_date;

  if (!fromIso || !toIso) {
    return NextResponse.json({ error: "Invalid date format. Expected DD-MM-YYYY or YYYY-MM-DD" }, { status: 422 });
  }

  if (fromIso > toIso) {
    return NextResponse.json({ error: "From Date cannot be later than To Date" }, { status: 422 });
  }

  try {
    const result = await previewLeave({
      loginId: session.login_id,
      fromDate: fromIso,
      toDate: toIso,
      leaveType: leave_type,
      saturdayGroup: saturday_group,
    });

    return NextResponse.json({
      ok: true,
      working_days: result.workingDays,
      total_days: result.totalDays,
      excluded_days: result.excludedDays,
      current_balance: result.currentBalance,
      deducted: result.deducted,
      unpaid: result.unpaid,
      balance_after: result.balanceAfter,
      has_overlap: result.hasOverlap,
      conflicting_application_id: result.conflictingApplicationId,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to preview leave calculation";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
