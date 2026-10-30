import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiWorkflowAdmin } from "@/lib/auth";
import { SESSION_COOKIE } from "@/lib/session";
import { getDb } from "@/lib/db";

const AppRoleSchema = z.object({
  login_id: z.string().min(1),
  app_role: z.enum(["admin_staff", "exam_cell", "workflow_admin"]),
});

export async function POST(request: NextRequest) {
  const rawCookie = request.cookies.get(SESSION_COOKIE)?.value;
  const auth = await requireApiWorkflowAdmin(rawCookie);
  if (auth.errorResponse) return auth.errorResponse;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parseResult = AppRoleSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: parseResult.error.issues[0]?.message || "Validation failed" },
      { status: 422 }
    );
  }

  const { login_id, app_role } = parseResult.data;
  const db = getDb();

  const { data: person } = await db
    .from("people")
    .select("login_id")
    .eq("login_id", login_id)
    .maybeSingle();

  if (!person) {
    return NextResponse.json(
      { error: `Person with login_id '${login_id}' not found` },
      { status: 404 }
    );
  }

  const { error } = await db.from("app_roles").upsert(
    { login_id, app_role },
    { onConflict: "login_id,app_role" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, login_id, app_role }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const rawCookie = request.cookies.get(SESSION_COOKIE)?.value;
  const auth = await requireApiWorkflowAdmin(rawCookie);
  if (auth.errorResponse) return auth.errorResponse;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parseResult = AppRoleSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: parseResult.error.issues[0]?.message || "Validation failed" },
      { status: 422 }
    );
  }

  const { login_id, app_role } = parseResult.data;
  const db = getDb();

  const { error } = await db
    .from("app_roles")
    .delete()
    .eq("login_id", login_id)
    .eq("app_role", app_role);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, deleted: { login_id, app_role } });
}
