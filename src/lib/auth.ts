import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { getDb } from "./db";
import { isPersonActive } from "./sync/active";
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

  // If session is a legacy mock/dev session, redirect to EkLink SSO login
  if (session.sub.startsWith("dev-sub-") || session.tok === "dev.tok.val") {
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

  // Deactivated in EkLink (people.is_active = false): the session stops working immediately.
  if (!(await isPersonActive(session.login_id))) {
    redirect("/auth/error?e=account_inactive");
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

  // Deactivated in EkLink (people.is_active = false): the session stops working immediately.
  if (!(await isPersonActive(session.login_id))) {
    return {
      session: null,
      errorResponse: NextResponse.json(
        { error: "unauthorized", message: "Account is deactivated" },
        { status: 401 }
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
  // ApproveIt workflow_admin, or an EkLink super / org / institute admin.
  if (!(await isSyncAdmin(session))) {
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

  if (!(await isSyncAdmin(auth.session))) {
    return {
      session: null,
      errorResponse: NextResponse.json(
        { error: "forbidden", message: "workflow_admin or EkLink platform admin required" },
        { status: 403 }
      ),
    };
  }

  return auth;
}

export const requireAdminSession = requireApiWorkflowAdmin;

/** EkLink platform roles that may run sync / see sync admin pages (besides workflow_admin). */
export const PLATFORM_ADMIN_ROLES = ["super_admin", "org_admin", "institute_admin"] as const;

/**
 * ApproveIt administration (every /admin page and API): ApproveIt workflow_admin
 * (or the legacy "admin" designation) or an EkLink super / org / institute admin
 * (people.platform_role). EkLink's legacy role "admin" alone is NOT enough: it is
 * also given to department admins, who must not run the whole of ApproveIt.
 */
export async function isSyncAdmin(session: Session): Promise<boolean> {
  const roles = await getAppRoles(session.login_id);
  if (roles.includes("workflow_admin") || roles.includes("admin")) return true;
  try {
    const { data, error } = await getDb()
      .from("people")
      .select("platform_role")
      .eq("login_id", session.login_id)
      .maybeSingle();
    if (error || !data) return false;
    return (PLATFORM_ADMIN_ROLES as readonly string[]).includes(
      String((data as { platform_role?: string | null }).platform_role ?? "")
    );
  } catch {
    return false;
  }
}

export async function requireApiSyncAdmin(rawCookie?: string): Promise<
  | { session: Session; errorResponse: null }
  | { session: null; errorResponse: NextResponse }
> {
  const auth = await requireApiSession(rawCookie);
  if (auth.errorResponse) return auth;
  if (!(await isSyncAdmin(auth.session))) {
    return {
      session: null,
      errorResponse: NextResponse.json(
        { error: "forbidden", message: "workflow_admin or EkLink platform admin required" },
        { status: 403 }
      ),
    };
  }
  return auth;
}

export async function requirePageSyncAdmin(): Promise<Session> {
  const session = await requirePageSession();
  if (!(await isSyncAdmin(session))) {
    redirect("/auth/error?e=forbidden_workflow_admin");
  }
  return session;
}
