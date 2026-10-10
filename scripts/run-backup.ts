/**
 * Standalone entry point for triggering a backup from outside the running
 * server — e.g. Windows Task Scheduler or cron, if you'd rather control
 * timing at the OS level than rely on the app's own in-process schedule
 * (src/instrumentation.ts). Safe to run while the server is up: it uses the
 * same pg_dump based backup-service the app uses internally (pg_dump must
 * be on PATH, or set PG_DUMP_PATH).
 */
import { config } from "../src/lib/config";
import { defaultBackupDir, runScheduledBackup } from "../src/lib/services/backup-service";

async function main() {
  const filePath = await runScheduledBackup(defaultBackupDir(), config.backupRetention);
  console.log(`Backup written to ${filePath}`);
}

main()
  .catch((err) => {
    console.error("Backup failed:", err);
    process.exitCode = 1;
  })
  .finally(() => process.exit());
