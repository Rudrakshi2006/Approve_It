import { type NextRequest, NextResponse } from "next/server";

// Routes that don't redirect to /auth/login at proxy level:
// - /auth, /_next, /favicon.ico: public assets & auth endpoints
// - /api: API routes handle their own auth & return 401/403 JSON via requireApiSession
const PUBLIC = ["/auth", "/_next", "/favicon.ico", "/api"];

export function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  // Cross-site navigation auto-sync:
  // When a user clicks the ApproveIt card from the EkLink dashboard (cross-site),
  // detect top-level document navigation and route through /auth/login to sync
  // with the currently active EkLink persona.
  // The 'synced' query param marks the landing request right after callback, preventing loops.
  const isCrossSiteDocNav =
    request.headers.get("sec-fetch-site") === "cross-site" &&
    request.headers.get("sec-fetch-dest") === "document" &&
    request.method === "GET" &&
    !searchParams.has("synced") &&
    !searchParams.has("_rsc");

  if (isCrossSiteDocNav) {
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  // If user has no active session, route to /auth/login
  if (!request.cookies.get("approveit_session")) {
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  return NextResponse.next();
}

export default proxy;
