/**
 * The Node.js half of src/instrumentation.ts: SQLite WAL mode and the
 * automatic server-wide backup schedule. Kept in its own module and imported
 * only under NEXT_RUNTIME === "nodejs", so the Edge build of instrumentation
 * never pulls in fs/path/Prisma.
 */
export async function registerNode() {
  const [{ config }, { defaultBackupDir, createSqliteBackup, pruneOldBackups }, { prisma }, fs, path] = await Promise.all([
    import("@/lib/config"),
    import("@/lib/services/backup-service"),
    import("@/lib/db"),
    import("node:fs/promises"),
    import("node:path"),
  ]);

  // WAL lets the many short reads from every household's phones and wall
  // displays proceed while a write is in progress, instead of queueing
  // behind it. It's a property of the database file, so setting it once at
  // startup is enough (and is a no-op once already set).
  try {
    await prisma.$queryRawUnsafe("PRAGMA journal_mode = WAL;");
  } catch (err) {
    console.error("[db] could not enable SQLite WAL mode:", err);
  }

  const CHECK_INTERVAL_MS = 60 * 60 * 1000; // check hourly; actual cadence follows BACKUP_INTERVAL_HOURS

  async function maybeRunBackup() {
    try {
      const dir = defaultBackupDir();

      let needsBackup = true;
      try {
        const files = (await fs.readdir(dir)).filter((f) => f.startsWith("choresome-") && f.endsWith(".db"));
        const latest = files.sort().at(-1);
        if (latest) {
          const stats = await fs.stat(path.join(dir, latest));
          const ageHours = (Date.now() - stats.mtimeMs) / 3_600_000;
          needsBackup = ageHours >= config.backupIntervalHours;
        }
      } catch {
        // Backup directory doesn't exist yet — needsBackup stays true.
      }

      if (needsBackup) {
        const filePath = await createSqliteBackup(dir);
        await pruneOldBackups(dir, config.backupRetention);
        console.log(`[backup] wrote automatic backup to ${filePath}`);
      }
    } catch (err) {
      console.error("[backup] scheduled backup check failed:", err);
    }
  }

  setTimeout(() => void maybeRunBackup(), 30_000);
  setInterval(() => void maybeRunBackup(), CHECK_INTERVAL_MS);
}
