import { type NextRequest, NextResponse } from "next/server";
import { requireApiSyncAdmin } from "@/lib/auth";
import { SESSION_COOKIE } from "@/lib/session";
import { runFull } from "@/lib/sync/runner";
import { SupabaseSyncStore } from "@/lib/sync/supabase-store";

/** "Full resync": apply /api/sync/snapshot, then continue with changes. Nothing is deleted. */
export async function POST(request: NextRequest) {
  const auth = await requireApiSyncAdmin(request.cookies.get(SESSION_COOKIE)?.value);
  if (auth.errorResponse) return auth.errorResponse;
  const result = await runFull({ store: new SupabaseSyncStore() });
  const status = result.ok ? 200 : result.skipped ? 409 : 502;
  return NextResponse.json(result, { status });
}
