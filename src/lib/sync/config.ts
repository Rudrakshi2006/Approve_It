/**
 * EkLink sync settings (SYNC_CONTRACT.md section 9).
 * Read straight from process.env so a missing/invalid unrelated variable never
 * crashes the scheduler. Pull is skipped when the EkLink settings are missing.
 */
export type SyncConfig = {
  eklinkUrl: string;
  issuer: string;
  clientId: string;
  clientSecret: string;
  enabled: boolean;
  intervalMinutes: number;
  fullAt: { hour: number; minute: number };
};

function trimSlash(v: string | undefined): string {
  return (v ?? "").trim().replace(/\/+$/, "");
}

export function parseFullAt(raw: string | undefined): { hour: number; minute: number } {
  const m = /^(\d{1,2}):(\d{2})$/.exec((raw ?? "").trim());
  if (m) {
    const hour = Number(m[1]);
    const minute = Number(m[2]);
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) return { hour, minute };
  }
  return { hour: 2, minute: 0 };
}

export function getSyncConfig(env: NodeJS.ProcessEnv = process.env): SyncConfig {
  const eklinkUrl = trimSlash(env.EKLINK_URL);
  const issuer = trimSlash(env.EKLINK_ISSUER) || eklinkUrl;
  const clientId = (env.EKLINK_CLIENT_ID ?? "").trim();
  const clientSecret = env.EKLINK_CLIENT_SECRET ?? "";
  const configured = Boolean(eklinkUrl && issuer && clientId && clientSecret);
  const flag = (env.EKLINK_SYNC_ENABLED ?? "").trim().toLowerCase();
  const explicitlyOff = flag === "false" || flag === "0" || flag === "off" || flag === "no";
  const interval = Number(env.EKLINK_SYNC_INTERVAL_MINUTES);

  return {
    eklinkUrl,
    issuer,
    clientId,
    clientSecret,
    enabled: configured && !explicitlyOff,
    intervalMinutes: Number.isFinite(interval) && interval >= 1 ? Math.floor(interval) : 15,
    fullAt: parseFullAt(env.EKLINK_SYNC_FULL_AT),
  };
}
