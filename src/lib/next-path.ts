/**
 * Where to send the user after the EkLink sign-in round trip.
 * Only same-app paths are accepted ("/admin/sync?x=1"); anything that could
 * leave ApproveIt ("//evil.com", "https://…", "/\\evil", auth routes) is refused,
 * so the parameter cannot be used as an open redirect.
 */
export const NEXT_COOKIE = "approveit_next";

export function safeNextPath(value: string | null | undefined): string | null {
  if (!value) return null;
  const path = value.trim();
  if (path.length > 512) return null;
  if (!path.startsWith("/") || path.startsWith("//") || path.startsWith("/\\")) return null;
  if (/[\u0000-\u001f]/.test(path) || path.includes("\\")) return null;
  // Never bounce back into the auth flow itself (loops).
  if (path === "/auth" || path.startsWith("/auth/") || path.startsWith("/auth?")) return null;
  return path;
}

/** Adds synced=1 so the proxy does not start another EkLink round trip. */
export function withSynced(path: string): string {
  const [base, hash = ""] = path.split("#", 2);
  const joiner = base.includes("?") ? "&" : "?";
  return `${base}${joiner}synced=1${hash ? `#${hash}` : ""}`;
}
