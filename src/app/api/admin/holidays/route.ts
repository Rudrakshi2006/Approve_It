import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminSession } from "@/lib/auth";
import { SESSION_COOKIE } from "@/lib/session";
import { getDb } from "@/lib/db";
import { parseDDMMYYYYtoISO } from "@/lib/dates";

const HolidaySchema = z.object({
  date: z.string().min(1),
  name: z.string().min(2, "Holiday name is required"),
});

const BulkHolidaySchema = z.object({
  holidays: z.array(HolidaySchema).min(1),
});

function toIso(d: string): string | null {
  if (/^\d{2}-\d{2}-\d{4}$/.test(d)) {
    return parseDDMMYYYYtoISO(d);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
    return d;
  }
  return null;
}

export async function GET(request: NextRequest) {
  const rawCookie = request.cookies.get(SESSION_COOKIE)?.value;
  const auth = await requireAdminSession(rawCookie);

  if (auth.errorResponse) {
    return auth.errorResponse;
  }

  const db = getDb();
  const { data, error } = await db
    .from("holidays")
    .select("*")
    .order("date", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ holidays: data || [] });
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

  const db = getDb();

  // Check if bulk or single
  const bulkResult = BulkHolidaySchema.safeParse(body);
  if (bulkResult.success) {
    const rows = [];
    for (const item of bulkResult.data.holidays) {
      const iso = toIso(item.date);
      if (!iso) {
        return NextResponse.json({ error: `Invalid date format: ${item.date}` }, { status: 422 });
      }
      rows.push({
        date: iso,
        name: item.name.trim(),
      });
    }

    const { error: upsertErr } = await db.from("holidays").upsert(rows, { onConflict: "date" });
    if (upsertErr) {
      return NextResponse.json({ error: upsertErr.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, count: rows.length });
  }

  const singleResult = HolidaySchema.safeParse(body);
  if (!singleResult.success) {
    return NextResponse.json(
      { error: singleResult.error.issues[0]?.message || "Validation failed" },
      { status: 422 }
    );
  }

  const iso = toIso(singleResult.data.date);
  if (!iso) {
    return NextResponse.json({ error: "Invalid date format. Expected DD-MM-YYYY or YYYY-MM-DD" }, { status: 422 });
  }

  const { error: insErr } = await db.from("holidays").upsert(
    {
      date: iso,
      name: singleResult.data.name.trim(),
    },
    { onConflict: "date" }
  );

  if (insErr) {
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, date: iso });
}

export async function DELETE(request: NextRequest) {
  const rawCookie = request.cookies.get(SESSION_COOKIE)?.value;
  const auth = await requireAdminSession(rawCookie);

  if (auth.errorResponse) {
    return auth.errorResponse;
  }

  const url = new URL(request.url);
  const date = url.searchParams.get("date");
  if (!date) {
    return NextResponse.json({ error: "Missing date query parameter" }, { status: 400 });
  }

  const db = getDb();
  const { error } = await db.from("holidays").delete().eq("date", date);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, deleted: date });
}
