/**
 * The Node.js half of src/instrumentation.ts: the automatic server-wide
 * database backup schedule. Kept in its own module and imported only under
 * NEXT_RUNTIME === "nodejs", so the Edge build of instrumentation never pulls
 * in fs/path/child_process.
 */
export async function registerNode() {
  const [{ config }, backups, fs, path] = await Promise.all([
    import("@/lib/config"),
    import("@/lib/services/backup-service"),
    import("node:fs/promises"),
    import("node:path"),
  ]);

  if (config.backupIntervalHours <= 0) {
    console.log("[backup] BACKUP_INTERVAL_HOURS=0 -- in-process backups are off.");
    return;
  }

  const CHECK_INTERVAL_MS = 60 * 60 * 1000; // check hourly; actual cadence follows BACKUP_INTERVAL_HOURS
  let timer: ReturnType<typeof setInterval> | undefined;

  async function maybeRunBackup() {
    try {
      const dir = backups.defaultBackupDir();

      let needsBackup = true;
      try {
        const latest = (await fs.readdir(dir)).filter(backups.isBackupFile).sort().at(-1);
        if (latest) {
          const stats = await fs.stat(path.join(dir, latest));
          const ageHours = (Date.now() - stats.mtimeMs) / 3_600_000;
          needsBackup = ageHours >= config.backupIntervalHours;
        }
      } catch {
        // Backup directory doesn't exist yet — needsBackup stays true.
      }

      if (needsBackup) {
        const filePath = await backups.runScheduledBackup(dir, config.backupRetention);
        console.log(`[backup] wrote automatic backup to ${filePath}`);
      }
    } catch (err) {
      if (err instanceof backups.PgDumpMissingError) {
        // Say so once and stop, rather than logging the same failure every hour.
        console.warn(
          `[backup] ${err.message}. Install the PostgreSQL client tools or set PG_DUMP_PATH, ` +
            "or set BACKUP_INTERVAL_HOURS=0 if your database host already takes backups. Automatic backups are off."
        );
        if (timer) clearInterval(timer);
        return;
      }
      console.error("[backup] scheduled backup failed:", err);
    }
  }

  setTimeout(() => void maybeRunBackup(), 30_000);
  timer = setInterval(() => void maybeRunBackup(), CHECK_INTERVAL_MS);
}
