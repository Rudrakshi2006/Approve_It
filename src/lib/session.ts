import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { getEnv } from "./env";

export const SESSION_COOKIE = "approveit_session";
export const SESSION_MAX_AGE = 8 * 3600; // 8 hours absolute cap

export type Session = {
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
  exp: number; // Absolute session expiration timestamp
};

export const cookieOpts = (maxAge: number) => ({
  httpOnly: true,
  secure: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge,
});

function getSessionSecret(): Uint8Array {
  return new TextEncoder().encode(getEnv().APP_SESSION_SECRET);
}

export async function signSession(s: Session): Promise<string> {
  const secret = getSessionSecret();
  return new SignJWT(s as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(s.exp)
    .sign(secret);
}

export async function readSession(raw?: string): Promise<Session | null> {
  if (!raw) return null;
  try {
    const secret = getSessionSecret();
    const { payload } = await jwtVerify(raw, secret, { algorithms: ["HS256"] });
    return payload as unknown as Session;
  } catch {
    return null;
  }
}

/**
 * Read-only helper for Server Components and Route Handlers.
 * Returns null when there is no valid session or when the EkLink token
 * has expired (indicating refresh is needed).
 */
export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies();
  const rawCookie = cookieStore.get(SESSION_COOKIE)?.value;
  const s = await readSession(rawCookie);
  if (!s) return null;

  const nowSec = Math.floor(Date.now() / 1000);
  // If session itself expired or EkLink token expired
  if (s.exp <= nowSec || s.tok_exp <= nowSec) {
    return null;
  }

  return s;
}
