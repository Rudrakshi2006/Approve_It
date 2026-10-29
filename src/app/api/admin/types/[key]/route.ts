import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiWorkflowAdmin } from "@/lib/auth";
import { SESSION_COOKIE } from "@/lib/session";
import { getDb } from "@/lib/db";
import { ChainSchema } from "@/lib/workflow/chains";

const UpdateTypeSchema = z.object({
  enabled: z.boolean().optional(),
  name: z.string().min(1).optional(),
  chain: ChainSchema.optional(),
});

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ key: string }> }
) {
  const rawCookie = request.cookies.get(SESSION_COOKIE)?.value;
  const auth = await requireApiWorkflowAdmin(rawCookie);
  if (auth.errorResponse) return auth.errorResponse;

  const { key } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parseResult = UpdateTypeSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: parseResult.error.issues[0]?.message || "Validation failed" },
      { status: 422 }
    );
  }

  const updates: Record<string, unknown> = {};
  if (parseResult.data.enabled !== undefined) updates.enabled = parseResult.data.enabled;
  if (parseResult.data.name !== undefined) updates.name = parseResult.data.name;
  if (parseResult.data.chain !== undefined) updates.chain = parseResult.data.chain;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const db = getDb();
  const { data, error } = await db
    .from("application_types")
    .update(updates)
    .eq("key", key)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ type: data });
}
