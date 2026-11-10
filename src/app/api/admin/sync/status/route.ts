import { type NextRequest, NextResponse } from "next/server";
import { requireApiSyncAdmin } from "@/lib/auth";
import { SESSION_COOKIE } from "@/lib/session";
import { getSyncStatus } from "@/lib/sync/status";

export async function GET(request: NextRequest) {
  const auth = await requireApiSyncAdmin(request.cookies.get(SESSION_COOKIE)?.value);
  if (auth.errorResponse) return auth.errorResponse;
  try {
    return NextResponse.json(await getSyncStatus());
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "status_failed" },
      { status: 500 }
    );
  }
}
