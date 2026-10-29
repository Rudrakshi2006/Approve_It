/**
 * Validates and sanitizes a redirect target.
 * Must start with single '/', must not start with '//', must not contain '\',
 * and must not redirect back into /auth to prevent redirect loops.
 */
export function getSafeNextUrl(rawNext: string | null): string {
  if (!rawNext) return "/";

  if (
    rawNext.startsWith("/") &&
    !rawNext.startsWith("//") &&
    !rawNext.includes("\\") &&
    !rawNext.startsWith("/auth")
  ) {
    return rawNext;
  }
  return "/";
}
