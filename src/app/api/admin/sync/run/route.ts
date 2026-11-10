import { type NextRequest, NextResponse } from "next/server";
import { requireApiSyncAdmin } from "@/lib/auth";
import { SESSION_COOKIE } from "@/lib/session";
import { runPull } from "@/lib/sync/runner";
import { SupabaseSyncStore } from "@/lib/sync/supabase-store";

/** "Sync now": pull /api/sync/changes after the stored last_event_id. */
export async function POST(request: NextRequest) {
  const auth = await requireApiSyncAdmin(request.cookies.get(SESSION_COOKIE)?.value);
  if (auth.errorResponse) return auth.errorResponse;
  const result = await runPull({ store: new SupabaseSyncStore() });
  const status = result.ok ? 200 : result.skipped ? 409 : 502;
  return NextResponse.json(result, { status });
}
