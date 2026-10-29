import { describe, expect, it, beforeAll } from "vitest";
import { requireApiSession } from "../auth";
import { signSession, type Session } from "../session";

describe("API Auth Guards & Role Verification (Test #10)", () => {
  const secret = "01234567890123456789012345678901234567890123456789";

  beforeAll(() => {
    process.env.APP_SESSION_SECRET = secret;
    process.env.EKLINK_URL = "https://eklink-test.vercel.app";
    process.env.EKLINK_ISSUER = "https://eklink-test.vercel.app";
    process.env.EKLINK_CLIENT_ID = "client";
    process.env.EKLINK_CLIENT_SECRET = "secret";
    process.env.EKLINK_REDIRECT_URI = "http://localhost:3002/auth/callback";
    process.env.APP_URL = "http://localhost:3002";
    process.env.SUPABASE_URL = "https://test.supabase.co";
    process.env.SUPABASE_SECRET_KEY = "test_secret_key";
  });

  const baseSession: Session = {
    sub: "sub-1",
    login_id: "STU1001",
    name: "Aarav Patel",
    email: "aarav@sitnagpur.edu.in",
    eklink_role: "student",
    department: "CSE",
    batch: "2023-27",
    section: "A",
    tok: "jwt.token",
    tok_exp: Math.floor(Date.now() / 1000) + 900,
    exp: Math.floor(Date.now() / 1000) + 8 * 3600,
  };

  it("returns 401 when no session cookie is provided", async () => {
    const result = await requireApiSession(undefined);
    expect(result.session).toBeNull();
    expect(result.errorResponse?.status).toBe(401);
  });

  it("returns 401 when session cookie is invalid", async () => {
    const result = await requireApiSession("invalid-junk-cookie");
    expect(result.session).toBeNull();
    expect(result.errorResponse?.status).toBe(401);
  });

  it("returns 401 when EkLink token has expired", async () => {
    const expiredTokSession: Session = {
      ...baseSession,
      tok_exp: Math.floor(Date.now() / 1000) - 5,
    };
    const cookie = await signSession(expiredTokSession);
    const result = await requireApiSession(cookie);
    expect(result.session).toBeNull();
    expect(result.errorResponse?.status).toBe(401);
  });

  it("returns session when role is allowed", async () => {
    const cookie = await signSession(baseSession);
    const result = await requireApiSession(cookie);
    expect(result.errorResponse).toBeNull();
    expect(result.session?.login_id).toBe("STU1001");
  });

  it("returns 403 when role is not in allowed list", async () => {
    const unauthorizedRoleSession: Session = {
      ...baseSession,
      eklink_role: "finance", // finance is not an allowed role
    };
    const cookie = await signSession(unauthorizedRoleSession);
    const result = await requireApiSession(cookie);
    expect(result.session).toBeNull();
    expect(result.errorResponse?.status).toBe(403);
  });
});
