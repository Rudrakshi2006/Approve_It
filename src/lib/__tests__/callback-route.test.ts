import { describe, expect, it, beforeAll, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/auth/callback/route";
import * as eklinkMod from "@/lib/eklink";
import * as peopleMod from "@/lib/people";
import { SESSION_COOKIE } from "@/lib/session";

describe("Auth Callback Route Handler", () => {
  beforeAll(() => {
    process.env.APP_SESSION_SECRET = "01234567890123456789012345678901234567890123456789";
    process.env.EKLINK_URL = "https://eklink-test.vercel.app";
    process.env.EKLINK_ISSUER = "https://eklink-test.vercel.app";
    process.env.EKLINK_CLIENT_ID = "client";
    process.env.EKLINK_CLIENT_SECRET = "secret";
    process.env.EKLINK_REDIRECT_URI = "http://localhost:3002/auth/callback";
    process.env.APP_URL = "http://localhost:3002";
    process.env.SUPABASE_URL = "https://test.supabase.co";
    process.env.SUPABASE_SECRET_KEY = "test_secret_key";
  });

  it("redirects to error on state mismatch and does NOT set session cookie", async () => {
    const req = new NextRequest("http://localhost:3002/auth/callback?code=abc&state=badstate", {
      headers: {
        cookie: "eklink_state=correctstate",
      },
    });

    const res = await GET(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/auth/error?e=state");
    expect(res.cookies.get(SESSION_COOKIE)).toBeUndefined();
  });

  it("redirects to error on missing state and does NOT set session cookie", async () => {
    const req = new NextRequest("http://localhost:3002/auth/callback?code=abc&state=badstate");
    const res = await GET(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/auth/error?e=state");
    expect(res.cookies.get(SESSION_COOKIE)).toBeUndefined();
  });

  it("handles role not allowed error", async () => {
    vi.spyOn(eklinkMod, "exchangeCode").mockResolvedValueOnce("mock-token");
    vi.spyOn(eklinkMod, "verifyEklinkToken").mockResolvedValueOnce({
      sub: "finance-uuid",
      login_id: "FIN999",
      email: "finance@sitnagpur.edu.in",
      name: "Finance User",
      role: "finance", // not in allowed roles
      department: null,
      batch: null,
      section: null,
      ver: 1,
      exp: Math.floor(Date.now() / 1000) + 900,
    });
    vi.spyOn(peopleMod, "upsertPerson").mockResolvedValueOnce();

    const req = new NextRequest("http://localhost:3002/auth/callback?code=abc&state=validstate", {
      headers: {
        cookie: "eklink_state=validstate",
      },
    });

    const res = await GET(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/auth/error?e=role_not_allowed");
    expect(res.cookies.get(SESSION_COOKIE)).toBeUndefined();
  });
});
