/**
 * Next.js instrumentation hook: starts the EkLink sync scheduler once per server
 * (Node.js runtime only; never on Edge). Errors are logged, never thrown.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  try {
    const { startSyncScheduler } = await import("./lib/sync/scheduler");
    startSyncScheduler();
  } catch (err) {
    console.warn(
      `[eklink-sync] scheduler failed to start: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}
