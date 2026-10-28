import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { SESSION_COOKIE } from "@/lib/session";

export async function POST() {
  const env = getEnv();
  const dashboardUrl = new URL("/dashboard", env.EKLINK_URL);

  const res = NextResponse.redirect(dashboardUrl, { status: 303 });
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}

export async function GET() {
  return new NextResponse("Method Not Allowed", { status: 405 });
}
