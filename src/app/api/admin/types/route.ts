import { type NextRequest, NextResponse } from "next/server";
import { requireApiWorkflowAdmin } from "@/lib/auth";
import { SESSION_COOKIE } from "@/lib/session";
import { getDb } from "@/lib/db";

export async function GET(request: NextRequest) {
  const rawCookie = request.cookies.get(SESSION_COOKIE)?.value;
  const auth = await requireApiWorkflowAdmin(rawCookie);
  if (auth.errorResponse) return auth.errorResponse;

  const db = getDb();
  const { data, error } = await db
    .from("application_types")
    .select("*")
    .order("key", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ types: data || [] });
}
