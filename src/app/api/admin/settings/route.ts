import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminSession } from "@/lib/auth";
import { SESSION_COOKIE } from "@/lib/session";
import { getDb } from "@/lib/db";

const SettingsUpdateSchema = z.object({
  key: z.string().min(1),
  value: z.unknown(),
});

export async function GET(request: NextRequest) {
  const rawCookie = request.cookies.get(SESSION_COOKIE)?.value;
  const auth = await requireAdminSession(rawCookie);

  if (auth.errorResponse) {
    return auth.errorResponse;
  }

  const db = getDb();
  const { data, error } = await db.from("app_settings").select("*");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const settingsMap: Record<string, unknown> = {};
  for (const s of data || []) {
    settingsMap[s.key] = s.value;
  }

  return NextResponse.json({ settings: settingsMap });
}

export async function POST(request: NextRequest) {
  const rawCookie = request.cookies.get(SESSION_COOKIE)?.value;
  const auth = await requireAdminSession(rawCookie);

  if (auth.errorResponse) {
    return auth.errorResponse;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parseResult = SettingsUpdateSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: parseResult.error.issues[0]?.message || "Validation failed" },
      { status: 422 }
    );
  }

  const { key, value } = parseResult.data;
  const db = getDb();

  const { error } = await db.from("app_settings").upsert(
    {
      key,
      value,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, key, value });
}
