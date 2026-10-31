import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { getSession } from "@/lib/session";

export async function GET() {
  // If user already has a valid session, redirect to home
  const existingSession = await getSession();
  if (existingSession) {
    const env = getEnv();
    return NextResponse.redirect(new URL("/", env.APP_URL));
  }

  const env = getEnv();
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

  return res;
}
