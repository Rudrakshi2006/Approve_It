import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { SESSION_COOKIE } from "@/lib/session";

export async function POST() {
  const env = getEnv();
  const dest = new URL("/dashboard", env.EKLINK_URL);

  const res = NextResponse.redirect(dest, { status: 303 });
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  res.cookies.set("eklink_state", "", { path: "/auth", maxAge: 0 });
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export async function GET() {
  const env = getEnv();
  const dest = new URL("/dashboard", env.EKLINK_URL);

  const res = NextResponse.redirect(dest, { status: 303 });
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  res.cookies.set("eklink_state", "", { path: "/auth", maxAge: 0 });
  res.headers.set("Cache-Control", "no-store");
  return res;
}
