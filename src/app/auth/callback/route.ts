import { timingSafeEqual } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { exchangeCode, verifyEklinkToken } from "@/lib/eklink";
import { getEnv } from "@/lib/env";
import { upsertPerson } from "@/lib/people";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  cookieOpts,
  signSession,
} from "@/lib/session";

const ALLOWED_ROLES = new Set([
  "student",
  "faculty",
  "staff",
  "hod",
  "director",
  "admin",
]);

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export async function GET(request: NextRequest) {
  const env = getEnv();
  const searchParams = request.nextUrl.searchParams;

  // 1. Check if EkLink returned an error parameter
  const eklinkError = searchParams.get("error");
  if (eklinkError) {
    const errorRedirect = NextResponse.redirect(
      new URL(`/auth/error?e=${encodeURIComponent(eklinkError)}`, env.APP_URL)
    );
    errorRedirect.cookies.set("eklink_state", "", { path: "/auth", maxAge: 0 });
    return errorRedirect;
  }

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const savedState = request.cookies.get("eklink_state")?.value;

  // 2. Validate state presence and match
  if (!code || !state || !savedState || !constantTimeEqual(state, savedState)) {
    const errorRedirect = NextResponse.redirect(
      new URL("/auth/error?e=state", env.APP_URL)
    );
    errorRedirect.cookies.set("eklink_state", "", { path: "/auth", maxAge: 0 });
    return errorRedirect;
  }

  try {
    // 3. Exchange authorization code for token
    const token = await exchangeCode(code);

    // 4. Verify token claims and signature
    const claims = await verifyEklinkToken(token);

    // 5. Check role allowance
    if (!ALLOWED_ROLES.has(claims.role)) {
      const errorRedirect = NextResponse.redirect(
        new URL("/auth/error?e=role_not_allowed", env.APP_URL)
      );
      errorRedirect.cookies.set("eklink_state", "", { path: "/auth", maxAge: 0 });
      return errorRedirect;
    }

    // 6. Upsert user in database
    await upsertPerson(claims);

    // 7. Create ApproveIt session with 8-hour cap
    const nowSec = Math.floor(Date.now() / 1000);
    const sessionExp = nowSec + SESSION_MAX_AGE;

    const sessionJwt = await signSession({
      sub: claims.sub,
      login_id: claims.login_id,
      name: claims.name,
      email: claims.email,
      eklink_role: claims.role,
      department: claims.department,
      batch: claims.batch,
      section: claims.section,
      tok: token,
      tok_exp: claims.exp,
      exp: sessionExp,
    });

    const res = NextResponse.redirect(new URL("/", env.APP_URL));
    res.cookies.set(SESSION_COOKIE, sessionJwt, cookieOpts(SESSION_MAX_AGE));
    res.cookies.set("eklink_state", "", { path: "/auth", maxAge: 0 });
    return res;
  } catch (err: unknown) {
    let errorCode = "signin";
    if (err instanceof Error) {
      if (err.message === "login_id_mismatch") {
        errorCode = "login_id_mismatch";
      }
    }
    const res = NextResponse.redirect(
      new URL(`/auth/error?e=${errorCode}`, env.APP_URL)
    );
    res.cookies.set("eklink_state", "", { path: "/auth", maxAge: 0 });
    return res;
  }
}
