import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSession } from "@/lib/auth";
import { SESSION_COOKIE } from "@/lib/session";
import { getDb } from "@/lib/db";

const SemesterSchema = z.object({
  semester: z.number().int().min(1).max(8),
});

export async function PATCH(request: NextRequest) {
  const rawCookie = request.cookies.get(SESSION_COOKIE)?.value;
  const auth = await requireApiSession(rawCookie);

  if (auth.errorResponse) {
    return auth.errorResponse;
  }

  const { session } = auth;

  // Only students can update semester
  if (session.eklink_role !== "student") {
    return NextResponse.json({ error: "Only students have a semester" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = SemesterSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Semester must be an integer between 1 and 8" },
      { status: 422 }
    );
  }

  const db = getDb();
  const { error } = await db
    .from("people")
    .update({
      semester: parsed.data.semester,
      updated_at: new Date().toISOString(),
    })
    .eq("login_id", session.login_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, semester: parsed.data.semester });
}
