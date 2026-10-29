import { type NextRequest, NextResponse } from "next/server";
import { signSession, SESSION_COOKIE, cookieOpts, SESSION_MAX_AGE } from "@/lib/session";
import { getEnv } from "@/lib/env";
import { getDb } from "@/lib/db";

export async function GET(request: NextRequest) {
  // Strictly disabled in production
  if (process.env.NODE_ENV === "production") {
    return new NextResponse("Not Found", { status: 404 });
  }

  const roleParam = request.nextUrl.searchParams.get("role") || "";
  const idParam = request.nextUrl.searchParams.get("id") || "";
  const nowSec = Math.floor(Date.now() / 1000);

  let sessionData: {
    sub: string;
    login_id: string;
    name: string;
    email: string;
    eklink_role: string;
    department: string | null;
    batch: string | null;
    section: string | null;
    tok: string;
    tok_exp: number;
    exp: number;
  } | null = null;

  // 1. Direct ID lookup in people table if ?id=T037 is passed
  if (idParam) {
    const db = getDb();
    const { data: p } = await db
      .from("people")
      .select("*")
      .ilike("login_id", idParam)
      .maybeSingle();

    if (p) {
      sessionData = {
        sub: `dev-sub-${p.login_id.toLowerCase()}`,
        login_id: p.login_id,
        name: p.name,
        email: p.email,
        eklink_role: p.eklink_role,
        department: p.department || "CSE",
        batch: p.batch || null,
        section: p.section || null,
        tok: "dev.tok.val",
        tok_exp: nowSec + 3600,
        exp: nowSec + SESSION_MAX_AGE,
      };
    }
  }

  // 2. Specific named shortcuts
  if (!sessionData) {
    if (roleParam === "hrushikesh" || roleParam === "T037") {
      sessionData = {
        sub: "dev-sub-t037",
        login_id: "T037",
        name: "Dr. Hrushikesh Madhukar Panchabudhe",
        email: "hrushikesh.panchabudhe@sitnagpur.siu.edu.in",
        eklink_role: "faculty",
        department: "CSE",
        batch: null,
        section: null,
        tok: "dev.tok.val",
        tok_exp: nowSec + 3600,
        exp: nowSec + SESSION_MAX_AGE,
      };
    } else if (roleParam === "faculty") {
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
    } else if (roleParam === "hod") {
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
    } else if (roleParam === "director") {
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
      // Default: Student Akshat
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
  }

  const token = await signSession(sessionData);
  const targetUrl = sessionData.eklink_role === "student" ? "/" : "/inbox";

  const env = getEnv();
  const response = NextResponse.redirect(new URL(targetUrl, env.APP_URL));
  response.cookies.set(SESSION_COOKIE, token, cookieOpts(SESSION_MAX_AGE));

  return response;
}
