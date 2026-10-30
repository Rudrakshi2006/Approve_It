import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiWorkflowAdmin } from "@/lib/auth";
import { SESSION_COOKIE } from "@/lib/session";
import { getDb } from "@/lib/db";

const CreateAssignmentSchema = z.object({
  application_type: z.string().min(1),
  step_key: z.string().min(1),
  approver_login_id: z.string().min(1),
  scope_key: z.string().optional().nullable(),
});

export async function GET(request: NextRequest) {
  const rawCookie = request.cookies.get(SESSION_COOKIE)?.value;
  const auth = await requireApiWorkflowAdmin(rawCookie);
  if (auth.errorResponse) return auth.errorResponse;

  const db = getDb();

  const [assignRes, rolesRes, peopleRes] = await Promise.all([
    db.from("approver_assignments").select("*").order("id", { ascending: true }),
    db.from("app_roles").select("*").order("app_role", { ascending: true }),
    db.from("people").select("login_id, name, department, eklink_role"),
  ]);

  return NextResponse.json({
    assignments: assignRes.data || [],
    roles: rolesRes.data || [],
    people: peopleRes.data || [],
  });
}

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

  const parseResult = CreateAssignmentSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: parseResult.error.issues[0]?.message || "Validation failed" },
      { status: 422 }
    );
  }

  const { application_type, step_key, approver_login_id, scope_key } = parseResult.data;
  const db = getDb();

  // Validate approver person exists in people
  const { data: person } = await db
    .from("people")
    .select("login_id")
    .eq("login_id", approver_login_id)
    .maybeSingle();

  if (!person) {
    return NextResponse.json(
      { error: `Person with login_id '${approver_login_id}' not found` },
      { status: 404 }
    );
  }

  const { data, error } = await db
    .from("approver_assignments")
    .insert({
      application_type,
      step_key,
      approver_login_id,
      scope_key: scope_key || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ assignment: data }, { status: 201 });
}
