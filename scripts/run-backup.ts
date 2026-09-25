/**
 * Standalone entry point for triggering a backup from outside the running
 * server — e.g. Windows Task Scheduler, if you'd rather control timing at
 * the OS level than rely on the app's own in-process schedule
 * (src/instrumentation.ts). Safe to run while the server is up: it uses the
 * same VACUUM INTO based backup-service the app uses internally.
 */
import { defaultBackupDir, runScheduledBackup } from "../src/lib/services/backup-service";
import { getHouseholdSettings } from "../src/lib/services/settings-service";

async function main() {
  const settings = await getHouseholdSettings();
  const backupDir = settings.backupDir || defaultBackupDir();
  const filePath = await runScheduledBackup(backupDir, settings.backupRetention);
  console.log(`Backup written to ${filePath}`);
}

main()
  .catch((err) => {
    console.error("Backup failed:", err);
    process.exitCode = 1;
  })
  .finally(() => process.exit());
