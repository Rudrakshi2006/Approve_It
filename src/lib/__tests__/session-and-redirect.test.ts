import { describe, expect, it, beforeAll } from "vitest";
import { timingSafeEqual } from "node:crypto";
import { signSession, readSession, type Session } from "../session";
import { getSafeNextUrl } from "../url";
import { _resetEnvCache } from "../env";

describe("Session Management & Redirect Safety", () => {
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

  const sampleSession: Session = {
    sub: "sub-123",
    login_id: "STU1001",
    name: "Aarav Patel",
    email: "aarav@sitnagpur.edu.in",
    eklink_role: "student",
    department: "CSE",
    batch: "2023-27",
    section: "A",
    tok: "mock.jwt.token",
    tok_exp: Math.floor(Date.now() / 1000) + 900,
    exp: Math.floor(Date.now() / 1000) + 8 * 3600,
  };

  it("signs and successfully reads a valid session", async () => {
    const jwt = await signSession(sampleSession);
    expect(typeof jwt).toBe("string");

    const decoded = await readSession(jwt);
    expect(decoded).not.toBeNull();
    expect(decoded?.login_id).toBe("STU1001");
    expect(decoded?.eklink_role).toBe("student");
  });

  it("rejects a tampered session token", async () => {
    const jwt = await signSession(sampleSession);
    const parts = jwt.split(".");
    const tampered = `${parts[0]}.${parts[1]}xyz.${parts[2]}`;

    const decoded = await readSession(tampered);
    expect(decoded).toBeNull();
  });

  it("rejects an expired session token", async () => {
    const expiredSession: Session = {
      ...sampleSession,
      exp: Math.floor(Date.now() / 1000) - 10,
    };
    const jwt = await signSession(expiredSession);

    const decoded = await readSession(jwt);
    expect(decoded).toBeNull();
  });

  it("rejects token signed with wrong secret", async () => {
    const jwt = await signSession(sampleSession);

    // Switch secret and reset env cache
    process.env.APP_SESSION_SECRET = "different-secret-key-that-is-at-least-32-bytes-long";
    _resetEnvCache();
    const decoded = await readSession(jwt);
    expect(decoded).toBeNull();

    // Restore secret
    process.env.APP_SESSION_SECRET = secret;
    _resetEnvCache();
  });

  describe("State Validation (Test #3)", () => {
    const constantTimeEqual = (a: string, b: string): boolean => {
      if (a.length !== b.length) return false;
      return timingSafeEqual(Buffer.from(a), Buffer.from(b));
    };

    it("accepts matching state", () => {
      const state = "a".repeat(32);
      expect(constantTimeEqual(state, state)).toBe(true);
    });

    it("rejects mismatched state", () => {
      const state1 = "a".repeat(32);
      const state2 = "b".repeat(32);
      expect(constantTimeEqual(state1, state2)).toBe(false);
    });

    it("rejects different length state", () => {
      const state1 = "a".repeat(32);
      const state2 = "a".repeat(30);
      expect(constantTimeEqual(state1, state2)).toBe(false);
    });
  });

  describe("Safe Next URL Validation", () => {
    const cases: Array<[string | null, string]> = [
      ["//evil.com", "/"],
      ["/\\evil.com", "/"],
      ["https://malicious.com", "/"],
      ["/auth/login", "/"],
      ["/auth/callback", "/"],
      ["/ok", "/ok"],
      ["/applications/123", "/applications/123"],
      [null, "/"],
      ["", "/"],
    ];

    it.each(cases)("validates '%s' -> '%s'", (input, expected) => {
      expect(getSafeNextUrl(input)).toBe(expected);
    });
  });
});
