import { type NextRequest, NextResponse } from "next/server";

// Routes that don't redirect to /auth/login at proxy level:
// - /auth, /_next, /favicon.ico: public assets & auth endpoints
// - /api: API routes handle their own auth & return 401/403 JSON via requireApiSession
const PUBLIC = ["/auth", "/_next", "/favicon.ico", "/api"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }
  if (!request.cookies.get("approveit_session")) {
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }
  return NextResponse.next();
}

export default proxy;
