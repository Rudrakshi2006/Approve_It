import { randomBytes } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { getEnv } from "@/lib/env";

export async function GET(request: NextRequest) {
  const env = getEnv();

  // If ?dev=true is explicitly requested in development, allow optional dev select
  const searchParams = request.nextUrl.searchParams;
  if (process.env.NODE_ENV !== "production" && searchParams.get("dev") === "true") {
    return NextResponse.redirect(new URL("/auth/select", env.APP_URL));
  }

  // Redirect directly to EkLink Central SSO
  const state = randomBytes(32).toString("base64url");
  const authUrl = new URL("/authorize", env.EKLINK_URL);
  authUrl.searchParams.set("client_id", env.EKLINK_CLIENT_ID);
  authUrl.searchParams.set("redirect_uri", env.EKLINK_REDIRECT_URI);
  authUrl.searchParams.set("state", state);

  const res = NextResponse.redirect(authUrl);
  res.cookies.set("eklink_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/auth",
    maxAge: 600, // 10 minutes
  });
  res.headers.set("Cache-Control", "no-store");

  return res;
}
