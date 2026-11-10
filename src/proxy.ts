import { type NextRequest, NextResponse } from "next/server";

// Routes that don't redirect to /auth/login at proxy level:
// - /auth, /_next, /favicon.ico: public assets & auth endpoints
// - /api: API routes handle their own auth & return 401/403 JSON via requireApiSession
// - /api/sync: EkLink push endpoint; the signed JWT body is the auth (no cookie/session)
const PUBLIC = ["/auth", "/_next", "/favicon.ico", "/api/sync", "/api"];

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
  // On localhost, EkLink (:3000) -> ApproveIt (:3002) is "same-site", not "cross-site".
  const fetchSite = request.headers.get("sec-fetch-site");
  const isCrossSiteDocNav =
    (fetchSite === "cross-site" || fetchSite === "same-site") &&
    request.headers.get("sec-fetch-dest") === "document" &&
    request.method === "GET" &&
    !searchParams.has("synced") &&
    !searchParams.has("_rsc");

  // Remember the page that was asked for, so the user lands back on it after
  // the EkLink round trip (validated again in /auth/login and /auth/callback).
  const loginUrl = new URL("/auth/login", request.url);
  if (pathname !== "/") {
    loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
  }

  if (isCrossSiteDocNav) {
    return NextResponse.redirect(loginUrl);
  }

  // If user has no active session, route to /auth/login
  if (!request.cookies.get("approveit_session")) {
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export default proxy;
