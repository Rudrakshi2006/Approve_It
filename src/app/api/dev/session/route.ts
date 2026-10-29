import { type NextRequest, NextResponse } from "next/server";
import { signSession, SESSION_COOKIE, cookieOpts, SESSION_MAX_AGE } from "@/lib/session";
import { getEnv } from "@/lib/env";

export async function GET(request: NextRequest) {
  // Strictly disabled in production
  if (process.env.NODE_ENV === "production") {
    return new NextResponse("Not Found", { status: 404 });
  }

  const role = request.nextUrl.searchParams.get("role") || "student";
  const nowSec = Math.floor(Date.now() / 1000);

  let sessionData;

  if (role === "faculty") {
    sessionData = {
      sub: "dev-sub-fac2001",
      login_id: "FAC2001",
      name: "Prof. Vikram Deshmukh",
      email: "vikram.deshmukh@sitnagpur.edu.in",
      eklink_role: "faculty",
      department: "CSE",
      batch: null,
      section: null,
      tok: "dev.tok.val",
      tok_exp: nowSec + 3600,
      exp: nowSec + SESSION_MAX_AGE,
    };
  } else if (role === "hod") {
    sessionData = {
      sub: "dev-sub-hod3001",
      login_id: "HOD3001",
      name: "Dr. Rajesh Sharma",
      email: "rajesh.sharma@sitnagpur.edu.in",
      eklink_role: "hod",
      department: "CSE",
      batch: null,
      section: null,
      tok: "dev.tok.val",
      tok_exp: nowSec + 3600,
      exp: nowSec + SESSION_MAX_AGE,
    };
  } else {
    // Default: student
    sessionData = {
      sub: "dev-sub-stu1001",
      login_id: "STU1001",
      name: "Aarav Patel",
      email: "aarav.patel@sitnagpur.edu.in",
      eklink_role: "student",
      department: "CSE",
      batch: "2024-28",
      section: "A",
      tok: "dev.tok.val",
      tok_exp: nowSec + 3600,
      exp: nowSec + SESSION_MAX_AGE,
    };
  }

  const token = await signSession(sessionData);
  const targetUrl = role === "student" ? "/" : "/inbox";

  const env = getEnv();
  const response = NextResponse.redirect(new URL(targetUrl, env.APP_URL));

  response.cookies.set(SESSION_COOKIE, token, cookieOpts(SESSION_MAX_AGE));

  return response;
}
