/**
 * Runs once when the Next.js server process starts. Used here to keep an
 * automatic, timestamped local SQLite backup running without needing any
 * OS-level scheduler — see scripts/run-backup.ts for an alternative if you'd
 * rather drive backups from Windows Task Scheduler instead.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const [{ getHouseholdSettings }, { defaultBackupDir, createSqliteBackup, pruneOldBackups }, fs, path] =
    await Promise.all([
      import("@/lib/services/settings-service"),
      import("@/lib/services/backup-service"),
      import("node:fs/promises"),
      import("node:path"),
    ]);

  const CHECK_INTERVAL_MS = 60 * 60 * 1000; // check hourly; actual backup cadence follows settings.backupIntervalHours

  async function maybeRunBackup() {
    try {
      const settings = await getHouseholdSettings();
      const dir = settings.backupDir || defaultBackupDir();

      let needsBackup = true;
      try {
        const files = (await fs.readdir(dir)).filter((f) => f.startsWith("choresome-") && f.endsWith(".db"));
        const latest = files.sort().at(-1);
        if (latest) {
          const stats = await fs.stat(path.join(dir, latest));
          const ageHours = (Date.now() - stats.mtimeMs) / 3_600_000;
          needsBackup = ageHours >= settings.backupIntervalHours;
        }
      } catch {
        // Backup directory doesn't exist yet — needsBackup stays true.
      }

      if (needsBackup) {
        const filePath = await createSqliteBackup(dir);
        await pruneOldBackups(dir, settings.backupRetention);
        console.log(`[backup] wrote automatic backup to ${filePath}`);
      }
    } catch (err) {
      console.error("[backup] scheduled backup check failed:", err);
    }
  }

  setTimeout(() => void maybeRunBackup(), 30_000);
  setInterval(() => void maybeRunBackup(), CHECK_INTERVAL_MS);
}
