import { type NextRequest, NextResponse } from "next/server";
import { refreshEklinkToken, verifyEklinkToken } from "@/lib/eklink";
import { getEnv } from "@/lib/env";
import { upsertPerson } from "@/lib/people";
import {
  SESSION_COOKIE,
  cookieOpts,
  readSession,
  signSession,
} from "@/lib/session";
import { getSafeNextUrl } from "@/lib/url";

export async function GET(request: NextRequest) {
  const env = getEnv();
  const nextParam = request.nextUrl.searchParams.get("next");
  const safeNext = getSafeNextUrl(nextParam);

  const failRedirect = () => {
    const res = NextResponse.redirect(new URL("/auth/login", env.APP_URL));
    res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
    return res;
  };

  const rawCookie = request.cookies.get(SESSION_COOKIE)?.value;
  if (!rawCookie) {
    return failRedirect();
  }

  try {
    const currentSession = await readSession(rawCookie);
    if (!currentSession) {
      return failRedirect();
    }

    // Call EkLink /token/refresh
    const freshToken = await refreshEklinkToken(currentSession.tok);
    if (!freshToken) {
      // User deactivated, force logout, or token revoked
      return failRedirect();
    }

    // Verify newly issued token
    const claims = await verifyEklinkToken(freshToken);

    // Update person data from latest claims
    await upsertPerson(claims);

    const nowSec = Math.floor(Date.now() / 1000);
    // Enforce 8-hour absolute cap
    const remainingAge = currentSession.exp - nowSec;
    if (remainingAge <= 0) {
      return failRedirect();
    }

    const updatedSessionJwt = await signSession({
      ...currentSession,
      tok: freshToken,
      tok_exp: claims.exp,
      eklink_role: claims.role,
      name: claims.name,
      email: claims.email,
      department: claims.department,
      batch: claims.batch,
      section: claims.section,
    });

    const res = NextResponse.redirect(new URL(safeNext, env.APP_URL));
    res.cookies.set(
      SESSION_COOKIE,
      updatedSessionJwt,
      cookieOpts(Math.max(remainingAge, 1))
    );
    return res;
  } catch {
    return failRedirect();
  }
}
