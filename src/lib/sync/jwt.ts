import "server-only";
import { jwtVerify, type JWTVerifyGetKey } from "jose";
import { getEklinkJwks } from "../eklink";
import { getSyncConfig } from "./config";
import { EventsArraySchema, type SyncEvent } from "./types";

export const EVENTS_JWT_TYP = "eklink-events+jwt";

export class EventsJwtError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EventsJwtError";
  }
}

/**
 * Verifies a pushed events JWT (SYNC_CONTRACT.md section 5.1):
 * ES256, typ "eklink-events+jwt", iss = EKLINK_ISSUER, aud = EKLINK_CLIENT_ID, exp required.
 * Returns the events sorted by ascending id. Throws EventsJwtError (never leaks details).
 */
export async function verifyEventsJwt(
  token: string,
  keyResolver?: JWTVerifyGetKey
): Promise<{ jti: string | null; events: SyncEvent[] }> {
  const cfg = getSyncConfig();
  if (!cfg.issuer || !cfg.clientId) {
    throw new EventsJwtError("sync_not_configured");
  }

  let payload: Record<string, unknown>;
  try {
    const result = await jwtVerify(token.trim(), keyResolver ?? getEklinkJwks(), {
      issuer: cfg.issuer,
      audience: cfg.clientId,
      algorithms: ["ES256"],
      typ: EVENTS_JWT_TYP,
      requiredClaims: ["exp", "iat"],
      clockTolerance: 10,
    });
    payload = result.payload as Record<string, unknown>;
  } catch {
    throw new EventsJwtError("invalid_signature");
  }

  const parsed = EventsArraySchema.safeParse(payload.events);
  if (!parsed.success) {
    throw new EventsJwtError("invalid_events");
  }

  const events = [...parsed.data].sort((a, b) => a.id - b.id);
  return { jti: typeof payload.jti === "string" ? payload.jti : null, events };
}
