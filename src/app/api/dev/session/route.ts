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
    // Real faculty from SIT Nagpur: Dr. Jasjit S. Suri
    sessionData = {
      sub: "dev-sub-t003",
      login_id: "T003",
      name: "Dr. Jasjit S. Suri",
      email: "jasjit.suri@sitnagpur.siu.edu.in",
      eklink_role: "faculty",
      department: "CSE",
      batch: null,
      section: null,
      tok: "dev.tok.val",
      tok_exp: nowSec + 3600,
      exp: nowSec + SESSION_MAX_AGE,
    };
  } else if (role === "hod") {
    // Real HOD CSE: Dr. Sagarkumar Shridhar Badhiye
    sessionData = {
      sub: "dev-sub-t004",
      login_id: "T004",
      name: "Dr. Sagarkumar Shridhar Badhiye",
      email: "sagarkumar.badhiye@sitnagpur.siu.edu.in",
      eklink_role: "hod",
      department: "CSE",
      batch: null,
      section: null,
      tok: "dev.tok.val",
      tok_exp: nowSec + 3600,
      exp: nowSec + SESSION_MAX_AGE,
    };
  } else if (role === "director") {
    // Real Director: Dr. Nitin Rakesh
    sessionData = {
      sub: "dev-sub-t001",
      login_id: "T001",
      name: "Dr. Nitin Rakesh",
      email: "nitin.rakesh@sitnagpur.siu.edu.in",
      eklink_role: "director",
      department: "CSE",
      batch: null,
      section: null,
      tok: "dev.tok.val",
      tok_exp: nowSec + 3600,
      exp: nowSec + SESSION_MAX_AGE,
    };
  } else {
    // Real student: Akshat Abhijeet Digalwar
    sessionData = {
      sub: "dev-sub-24070521003",
      login_id: "24070521003",
      name: "Akshat Abhijeet Digalwar",
      email: "akshat.digalwar.batch2024@sitnagpur.siu.edu.in",
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
