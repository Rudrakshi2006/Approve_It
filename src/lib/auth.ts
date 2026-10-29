import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { getDb } from "./db";
import {
  SESSION_COOKIE,
  readSession,
  type Session,
} from "./session";

export const ALLOWED_ROLES = [
  "student",
  "faculty",
  "staff",
  "hod",
  "director",
  "admin",
] as const;

export type AllowedRole = (typeof ALLOWED_ROLES)[number];

export function isAllowedRole(role: string): role is AllowedRole {
  return (ALLOWED_ROLES as readonly string[]).includes(role);
}

/**
 * Server Component / Page helper to enforce authenticated session.
 * - If no cookie exists -> redirects to /auth/login
 * - If session is invalid or expired (8h cap) -> redirects to /auth/login
 * - If EkLink token is expired -> redirects to /auth/refresh?next=<path>
 * - If role not allowed -> redirects to /auth/error?e=role_not_allowed
 */
export async function requirePageSession(): Promise<Session> {
  const headerList = await headers();
  const rawCookieHeader = headerList.get("cookie") ?? "";

  // Simple parse for SESSION_COOKIE from header
  const match = rawCookieHeader.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
  const rawCookie = match ? decodeURIComponent(match[1]) : undefined;

  if (!rawCookie) {
    redirect("/auth/login");
  }

  const session = await readSession(rawCookie);
  if (!session) {
    redirect("/auth/login");
  }

  const nowSec = Math.floor(Date.now() / 1000);

  // Check 8-hour absolute session cap
  if (session.exp <= nowSec) {
    redirect("/auth/login");
  }

  // Check EkLink token expiry
  if (session.tok_exp <= nowSec) {
    const pathname = headerList.get("x-pathname") || "/";
    redirect(`/auth/refresh?next=${encodeURIComponent(pathname)}`);
  }

  // Check coarse role allowance
  if (!isAllowedRole(session.eklink_role)) {
    redirect("/auth/error?e=role_not_allowed");
  }

  return session;
}

/**
 * API Route Handler helper.
 * Returns { session } if authorized, or a ready-to-return NextResponse (401 or 403).
 */
export async function requireApiSession(rawCookie?: string): Promise<
  | { session: Session; errorResponse: null }
  | { session: null; errorResponse: NextResponse }
> {
  if (!rawCookie) {
    return {
      session: null,
      errorResponse: NextResponse.json(
        { error: "unauthorized", message: "Sign in required" },
        { status: 401 }
      ),
    };
  }

  const session = await readSession(rawCookie);
  if (!session) {
    return {
      session: null,
      errorResponse: NextResponse.json(
        { error: "unauthorized", message: "Invalid session" },
        { status: 401 }
      ),
    };
  }

  const nowSec = Math.floor(Date.now() / 1000);
  if (session.exp <= nowSec || session.tok_exp <= nowSec) {
    return {
      session: null,
      errorResponse: NextResponse.json(
        { error: "unauthorized", message: "Session or token expired" },
        { status: 401 }
      ),
    };
  }

  if (!isAllowedRole(session.eklink_role)) {
    return {
      session: null,
      errorResponse: NextResponse.json(
        { error: "forbidden", message: "Role not authorized" },
        { status: 403 }
      ),
    };
  }

  return { session, errorResponse: null };
}

/**
 * Retrieves ApproveIt-specific designations for a user from app_roles table.
 */
export async function getAppRoles(loginId: string): Promise<string[]> {
  const db = getDb();
  const { data, error } = await db
    .from("app_roles")
    .select("app_role")
    .eq("login_id", loginId);

  if (error || !data) {
    return [];
  }

  return data.map((r: { app_role: string }) => r.app_role);
}

/**
 * Page-level workflow_admin check (redirects non-admins).
 */
export async function requirePageWorkflowAdmin(): Promise<Session> {
  const session = await requirePageSession();
  const roles = await getAppRoles(session.login_id);
  if (!roles.includes("workflow_admin")) {
    redirect("/auth/error?e=forbidden_workflow_admin");
  }
  return session;
}

/**
 * API-level workflow_admin check (returns 401 unauthenticated, 403 forbidden).
 */
export async function requireApiWorkflowAdmin(rawCookie?: string): Promise<
  | { session: Session; errorResponse: null }
  | { session: null; errorResponse: NextResponse }
> {
  const auth = await requireApiSession(rawCookie);
  if (auth.errorResponse) {
    return auth;
  }

  const roles = await getAppRoles(auth.session.login_id);
  if (!roles.includes("workflow_admin")) {
    return {
      session: null,
      errorResponse: NextResponse.json(
        { error: "forbidden", message: "workflow_admin designation required" },
        { status: 403 }
      ),
    };
  }

  return auth;
}
