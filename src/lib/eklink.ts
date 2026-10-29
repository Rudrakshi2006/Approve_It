import "server-only";
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import { getEnv } from "./env";

export type EklinkClaims = {
  sub: string;
  login_id: string;
  email: string;
  name: string;
  role: string;
  department: string | null;
  batch: string | null;
  section: string | null;
  ver: number;
  exp: number;
};

// Default JWKS resolver created lazily
let defaultJWKS: JWTVerifyGetKey | null = null;

function getDefaultJWKS(): JWTVerifyGetKey {
  if (!defaultJWKS) {
    const env = getEnv();
    defaultJWKS = createRemoteJWKSet(new URL(`${env.EKLINK_URL}/.well-known/jwks.json`));
  }
  return defaultJWKS;
}

/**
 * Verifies an EkLink identity token against JWKS.
 * Key resolver is injectable for unit testing with local key pairs.
 */
export async function verifyEklinkToken(
  token: string,
  keyResolver?: JWTVerifyGetKey
): Promise<EklinkClaims> {
  const env = getEnv();
  const jwks = keyResolver ?? getDefaultJWKS();

  try {
    const { payload } = await jwtVerify(token, jwks, {
      issuer: env.EKLINK_ISSUER,
      audience: env.EKLINK_CLIENT_ID,
      algorithms: ["ES256"],
      clockTolerance: 10,
    });

    const c = payload as Record<string, unknown>;

    if (
      typeof c.sub !== "string" ||
      typeof c.login_id !== "string" ||
      typeof c.email !== "string" ||
      typeof c.name !== "string" ||
      typeof c.role !== "string" ||
      typeof c.exp !== "number"
    ) {
      throw new Error("token_missing_required_claims");
    }

    return {
      sub: c.sub,
      login_id: c.login_id,
      email: c.email,
      name: c.name,
      role: c.role,
      department: typeof c.department === "string" ? c.department : null,
      batch: typeof c.batch === "string" ? c.batch : null,
      section: typeof c.section === "string" ? c.section : null,
      ver: typeof c.ver === "number" ? c.ver : 1,
      exp: c.exp,
    };
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "token_missing_required_claims") {
      throw err;
    }
    if (process.env.NODE_ENV !== "production") {
      console.error(
        "[verifyEklinkToken failed]:",
        err instanceof Error ? err.message : err
      );
    }
    // Generic error to avoid leaking details/signatures/tokens
    throw new Error("token_verification_failed");
  }
}

/**
 * Exchanges a one-time code for an EkLink access token.
 */
export async function exchangeCode(code: string): Promise<string> {
  const env = getEnv();

  let response: Response;
  try {
    response = await fetch(`${env.EKLINK_URL}/token`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code,
        redirect_uri: env.EKLINK_REDIRECT_URI,
        client_id: env.EKLINK_CLIENT_ID,
        client_secret: env.EKLINK_CLIENT_SECRET,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
  } catch (err: unknown) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[exchangeCode network error]:", err instanceof Error ? err.message : err);
    }
    throw new Error("code_exchange_network_error");
  }

  if (!response.ok) {
    if (process.env.NODE_ENV !== "production") {
      console.error(`[exchangeCode failed]: HTTP ${response.status}`);
    }
    throw new Error("code_exchange_failed");
  }

  try {
    const data = (await response.json()) as { access_token?: string };
    if (!data.access_token || typeof data.access_token !== "string") {
      throw new Error("code_exchange_invalid_response");
    }
    return data.access_token;
  } catch {
    throw new Error("code_exchange_failed");
  }
}

/**
 * Refreshes an expired/near-expiry EkLink access token.
 * Returns null if EkLink refuses (e.g. user deactivated, force logout).
 */
export async function refreshEklinkToken(oldToken: string): Promise<string | null> {
  const env = getEnv();

  try {
    const response = await fetch(`${env.EKLINK_URL}/token/refresh`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        client_id: env.EKLINK_CLIENT_ID,
        client_secret: env.EKLINK_CLIENT_SECRET,
        access_token: oldToken,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as { access_token?: string };
    if (!data.access_token || typeof data.access_token !== "string") {
      return null;
    }
    return data.access_token;
  } catch {
    return null;
  }
}
