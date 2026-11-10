import { timingSafeEqual } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { exchangeCode, verifyEklinkToken } from "@/lib/eklink";
import { getEnv } from "@/lib/env";
import { NEXT_COOKIE, safeNextPath, withSynced } from "@/lib/next-path";
import { upsertPerson } from "@/lib/people";
import { invalidateActiveCache, isPersonActive } from "@/lib/sync/active";
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
    const normalizedRole = claims.role.toLowerCase();

    // 5. Check role allowance
    if (!ALLOWED_ROLES.has(normalizedRole)) {
      const errorRedirect = NextResponse.redirect(
        new URL("/auth/error?e=role_not_allowed", env.APP_URL)
      );
      errorRedirect.cookies.set("eklink_state", "", { path: "/auth", maxAge: 0 });
      return errorRedirect;
    }

    // 6. Upsert user in database
    await upsertPerson({ ...claims, role: normalizedRole });

    // 6b. Refuse people deactivated in EkLink (mirrored people.is_active = false)
    invalidateActiveCache(claims.login_id);
    if (!(await isPersonActive(claims.login_id))) {
      const inactiveRedirect = NextResponse.redirect(
        new URL("/auth/error?e=account_inactive", env.APP_URL)
      );
      inactiveRedirect.cookies.set("eklink_state", "", { path: "/auth", maxAge: 0 });
      inactiveRedirect.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
      return inactiveRedirect;
    }

    // 7. Create ApproveIt session with 8-hour cap
    const nowSec = Math.floor(Date.now() / 1000);
    const sessionExp = nowSec + SESSION_MAX_AGE;

    const sessionJwt = await signSession({
      sub: claims.sub,
      login_id: claims.login_id,
      name: claims.name,
      email: claims.email,
      eklink_role: normalizedRole,
      department: claims.department,
      batch: claims.batch,
      section: claims.section,
      tok: token,
      tok_exp: claims.exp,
      exp: sessionExp,
    });

    // Back to the page that was asked for (e.g. /admin/sync), else the default landing.
    const requested = safeNextPath(request.cookies.get(NEXT_COOKIE)?.value);
    const dest = requested
      ? withSynced(requested)
      : normalizedRole === "director" || claims.login_id === "T001"
        ? "/inbox?synced=1"
        : "/?synced=1";
    const res = NextResponse.redirect(new URL(dest, env.APP_URL));
    res.cookies.set(SESSION_COOKIE, sessionJwt, cookieOpts(SESSION_MAX_AGE));
    res.cookies.set("eklink_state", "", { path: "/auth", maxAge: 0 });
    res.cookies.set(NEXT_COOKIE, "", { path: "/auth", maxAge: 0 });
    return res;
  } catch (err: unknown) {
    console.error("[auth/callback error]:", err);
    let errorCode = "signin";
    let detail = "";
    if (err instanceof Error) {
      detail = err.message;
      if (err.message === "login_id_mismatch") {
        errorCode = "login_id_mismatch";
      } else if (err.message === "invalid_client") {
        errorCode = "invalid_client";
      } else if (err.message.includes("invalid_grant")) {
        errorCode = "invalid_grant";
      }
    } else {
      detail = String(err);
    }
    const res = NextResponse.redirect(
      new URL(
        `/auth/error?e=${errorCode}&err=${encodeURIComponent(detail)}`,
        env.APP_URL
      )
    );
    res.cookies.set("eklink_state", "", { path: "/auth", maxAge: 0 });
    return res;
  }
}
