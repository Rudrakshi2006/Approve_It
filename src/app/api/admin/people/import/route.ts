import { type NextRequest, NextResponse } from "next/server";
import { requireApiWorkflowAdmin } from "@/lib/auth";
import { SESSION_COOKIE } from "@/lib/session";
import { getDb } from "@/lib/db";
import { parseAndValidateCsv } from "@/lib/people/csv-import";

export async function POST(request: NextRequest) {
  const rawCookie = request.cookies.get(SESSION_COOKIE)?.value;
  const auth = await requireApiWorkflowAdmin(rawCookie);
  if (auth.errorResponse) return auth.errorResponse;

  let body: { csv?: string; confirm?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.csv) {
    return NextResponse.json({ error: "CSV content is required" }, { status: 422 });
  }

  const parsed = parseAndValidateCsv(body.csv);
  if (!parsed.valid || !parsed.rows) {
    return NextResponse.json({ error: parsed.error }, { status: 422 });
  }

  // Preview mode
  if (!body.confirm) {
    return NextResponse.json({
      preview: true,
      total_count: parsed.rows.length,
      sample: parsed.rows.slice(0, 5),
    });
  }

  // Execution mode: Safe Upsert without touching eklink_sub, semester, signature_path
  const db = getDb();
  const recordsToUpsert = parsed.rows.map((r) => ({
    login_id: r.login_id,
    name: r.name,
    email: r.college_email,
    eklink_role: r.role,
    department: r.department,
  }));

  const { error: upsertErr } = await db
    .from("people")
    .upsert(recordsToUpsert, { onConflict: "login_id" });

  if (upsertErr) {
    return NextResponse.json({ error: upsertErr.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    imported_count: recordsToUpsert.length,
  });
}
