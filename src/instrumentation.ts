/**
 * Runs once when the Next.js server process starts. Used here to keep an
 * automatic, timestamped server-wide database backup (pg_dump) running without needing
 * any OS-level scheduler — see scripts/run-backup.ts for an alternative if
 * you'd rather drive backups from an external scheduler instead.
 *
 * Backups cover the whole database (every household), so their location and
 * cadence are operator settings (BACKUP_DIR / BACKUP_INTERVAL_HOURS /
 * BACKUP_RETENTION), never something a household can configure.
 */
export async function register() {
  // Statically replaced at build time, so the Edge bundle drops this import entirely.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { registerNode } = await import("./instrumentation-node");
    await registerNode();
  }
}
