import { type NextRequest, NextResponse } from "next/server";

const PUBLIC = ["/auth", "/_next", "/favicon.ico"];

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
