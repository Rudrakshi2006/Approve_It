import { describe, expect, it, beforeAll } from "vitest";
import { generateKeyPair, exportJWK, createLocalJWKSet, SignJWT } from "jose";
import { verifyEklinkToken } from "../eklink";

describe("EkLink Token Verification (Test #8)", () => {
  let es256KeyPair: Awaited<ReturnType<typeof generateKeyPair>>;
  let jwksResolver: ReturnType<typeof createLocalJWKSet>;

  const ISSUER = "https://eklink-test.vercel.app";
  const AUDIENCE = "test_client_id";

  beforeAll(async () => {
    process.env.EKLINK_URL = ISSUER;
    process.env.EKLINK_ISSUER = ISSUER;
    process.env.EKLINK_CLIENT_ID = AUDIENCE;
    process.env.EKLINK_CLIENT_SECRET = "secret";
    process.env.EKLINK_REDIRECT_URI = "http://localhost:3002/auth/callback";
    process.env.APP_URL = "http://localhost:3002";
    process.env.APP_SESSION_SECRET = "01234567890123456789012345678901234567890123456789";
    process.env.SUPABASE_URL = "https://test.supabase.co";
    process.env.SUPABASE_SECRET_KEY = "test_secret_key";

    es256KeyPair = await generateKeyPair("ES256");
    const publicJwk = await exportJWK(es256KeyPair.publicKey);
    publicJwk.alg = "ES256";
    publicJwk.use = "sig";
    publicJwk.kid = "test-key-1";

    jwksResolver = createLocalJWKSet({
      keys: [publicJwk],
    });
  });

  const validPayload = {
    sub: "99999999-9999-9999-9999-999999999999",
    login_id: "STU1001",
    email: "aarav@sitnagpur.edu.in",
    name: "Aarav Patel",
    role: "student",
    department: "CSE",
    batch: "2023-27",
    section: "A",
    ver: 1,
  };

  it("verifies a valid ES256 token successfully", async () => {
    const token = await new SignJWT(validPayload)
      .setProtectedHeader({ alg: "ES256", kid: "test-key-1" })
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setExpirationTime("15m")
      .sign(es256KeyPair.privateKey);

    const claims = await verifyEklinkToken(token, jwksResolver);
    expect(claims.sub).toBe(validPayload.sub);
    expect(claims.login_id).toBe(validPayload.login_id);
    expect(claims.role).toBe("student");
  });

  it("rejects an expired token", async () => {
    const token = await new SignJWT(validPayload)
      .setProtectedHeader({ alg: "ES256", kid: "test-key-1" })
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setExpirationTime("-1m")
      .sign(es256KeyPair.privateKey);

    await expect(verifyEklinkToken(token, jwksResolver)).rejects.toThrow(
      "token_verification_failed"
    );
  });

  it("rejects token with wrong audience", async () => {
    const token = await new SignJWT(validPayload)
      .setProtectedHeader({ alg: "ES256", kid: "test-key-1" })
      .setIssuer(ISSUER)
      .setAudience("wrong_aud")
      .setExpirationTime("15m")
      .sign(es256KeyPair.privateKey);

    await expect(verifyEklinkToken(token, jwksResolver)).rejects.toThrow(
      "token_verification_failed"
    );
  });

  it("rejects token with wrong issuer", async () => {
    const token = await new SignJWT(validPayload)
      .setProtectedHeader({ alg: "ES256", kid: "test-key-1" })
      .setIssuer("https://malicious-issuer.com")
      .setAudience(AUDIENCE)
      .setExpirationTime("15m")
      .sign(es256KeyPair.privateKey);

    await expect(verifyEklinkToken(token, jwksResolver)).rejects.toThrow(
      "token_verification_failed"
    );
  });

  it("rejects an HS256-signed token", async () => {
    const hsSecret = new TextEncoder().encode("some-random-symmetric-secret-key-32");
    const token = await new SignJWT(validPayload)
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setExpirationTime("15m")
      .sign(hsSecret);

    await expect(verifyEklinkToken(token, jwksResolver)).rejects.toThrow(
      "token_verification_failed"
    );
  });

  it("rejects alg:none unsigned token", async () => {
    // Manually construct unsigned JWT
    const header = Buffer.from(JSON.stringify({ alg: "none" })).toString("base64url");
    const payload = Buffer.from(
      JSON.stringify({
        ...validPayload,
        iss: ISSUER,
        aud: AUDIENCE,
        exp: Math.floor(Date.now() / 1000) + 900,
      })
    ).toString("base64url");
    const token = `${header}.${payload}.`;

    await expect(verifyEklinkToken(token, jwksResolver)).rejects.toThrow(
      "token_verification_failed"
    );
  });

  it("rejects tampered payload", async () => {
    const token = await new SignJWT(validPayload)
      .setProtectedHeader({ alg: "ES256", kid: "test-key-1" })
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setExpirationTime("15m")
      .sign(es256KeyPair.privateKey);

    const parts = token.split(".");
    // Tamper payload byte
    const tamperedPayload = Buffer.from(
      JSON.stringify({ ...validPayload, role: "admin", iss: ISSUER, aud: AUDIENCE, exp: Math.floor(Date.now() / 1000) + 900 })
    ).toString("base64url");
    const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

    await expect(verifyEklinkToken(tamperedToken, jwksResolver)).rejects.toThrow(
      "token_verification_failed"
    );
  });
});
