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

  // People linked to EkLink are managed in EkLink (sync): the CSV never overwrites them.
  const linked = new Set<string>();
  const ids = parsed.rows.map((r) => r.login_id);
  for (let i = 0; i < ids.length; i += 200) {
    const { data: linkedRows } = await db
      .from("people")
      .select("login_id")
      .in("login_id", ids.slice(i, i + 200))
      .not("eklink_sub", "is", null);
    for (const r of (linkedRows ?? []) as Array<{ login_id: string }>) linked.add(r.login_id);
  }

  const recordsToUpsert = parsed.rows.filter((r) => !linked.has(r.login_id)).map((r) => ({
    login_id: r.login_id,
    name: r.name,
    email: r.college_email,
    eklink_role: r.role,
    department: r.department,
  }));

  if (recordsToUpsert.length > 0) {
    const { error: upsertErr } = await db
      .from("people")
      .upsert(recordsToUpsert, { onConflict: "login_id" });

    if (upsertErr) {
      return NextResponse.json({ error: upsertErr.message }, { status: 500 });
    }
  }

  return NextResponse.json({
    ok: true,
    imported_count: recordsToUpsert.length,
    skipped_eklink_managed: linked.size,
  });
}
