import { type NextRequest, NextResponse } from "next/server";
import { EventsJwtError, verifyEventsJwt } from "@/lib/sync/jwt";
import { handlePushedEvents } from "@/lib/sync/runner";
import { SupabaseSyncStore } from "@/lib/sync/supabase-store";

/**
 * EkLink push endpoint (SYNC_CONTRACT.md 5.1).
 * Public: no session / cookie; the ES256 signature on the JWT body is the authentication.
 * (The proxy already lets every /api path through; this handler never reads cookies.)
 *   200 {"last_event_id": n} after applying, 401 bad signature, 500 on failure.
 */

const MAX_BODY_BYTES = 2 * 1024 * 1024;

export async function POST(request: NextRequest) {
  let body: string;
  try {
    body = await request.text();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  if (!body || body.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  // Accept the compact JWT as the raw body (application/jwt); tolerate a JSON wrapper too.
  let token = body.trim();
  if (token.startsWith("{")) {
    try {
      const parsed = JSON.parse(token) as { jwt?: unknown; token?: unknown };
      token = String(parsed.jwt ?? parsed.token ?? "");
    } catch {
      return NextResponse.json({ error: "invalid_body" }, { status: 400 });
    }
  }

  let events;
  try {
    ({ events } = await verifyEventsJwt(token));
  } catch (err) {
    const code = err instanceof EventsJwtError ? err.message : "invalid_signature";
    return NextResponse.json({ error: code }, { status: 401 });
  }

  try {
    const result = await handlePushedEvents(events, { store: new SupabaseSyncStore() });
    return NextResponse.json({ last_event_id: result.last_event_id });
  } catch (err) {
    console.error(
      "[sync/eklink/events] apply failed:",
      err instanceof Error ? err.message : String(err)
    );
    return NextResponse.json({ error: "apply_failed" }, { status: 500 });
  }
}
