import { mkdir, readdir, unlink } from "node:fs/promises";
import path from "node:path";
import { customAlphabet } from "nanoid";
import { prisma } from "@/lib/db";
import { householdExportBundleSchema, type HouseholdExportBundle } from "@/lib/validation/backup";

export async function exportHouseholdData(): Promise<HouseholdExportBundle> {
  const [household, members, areas, tasks, completionEvents] = await Promise.all([
    prisma.household.findUnique({ where: { id: 1 } }),
    prisma.member.findMany(),
    prisma.area.findMany(),
    prisma.task.findMany(),
    prisma.completionEvent.findMany(),
  ]);

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    household,
    members,
    areas,
    tasks,
    completionEvents,
  };
}

/** Wipes and restores all household data from a previously exported bundle, inside one transaction. */
export async function importHouseholdData(rawInput: unknown): Promise<void> {
  const data = householdExportBundleSchema.parse(rawInput);

  await prisma.$transaction(async (tx) => {
    await tx.completionEvent.deleteMany();
    await tx.task.deleteMany();
    await tx.area.deleteMany();
    await tx.member.deleteMany();
    await tx.household.deleteMany();

    if (data.household) {
      await tx.household.create({ data: data.household });
    }
    for (const member of data.members) {
      await tx.member.create({ data: member });
    }
    for (const area of data.areas) {
      await tx.area.create({ data: area });
    }
    for (const task of data.tasks) {
      await tx.task.create({ data: task });
    }
    for (const event of data.completionEvents) {
      await tx.completionEvent.create({ data: event });
    }
  });
}

const BACKUP_FILE_PREFIX = "choresome-";
const BACKUP_FILE_SUFFIX = ".db";
const randomSuffix = customAlphabet("23456789abcdefghjkmnpqrstuvwxyz", 4);

export function defaultBackupDir(): string {
  // Sibling of data/ at the project root — mirrors the DATABASE_URL convention
  // and lines up with the ./backups volume mount in docker-compose.yml.
  return path.resolve(process.cwd(), "backups");
}

/**
 * Creates a consistent point-in-time copy of the live SQLite database using
 * `VACUUM INTO`, which SQLite guarantees is transactionally safe even while
 * other connections are reading or writing — unlike a plain file copy, which
 * can capture a half-written page.
 */
export async function createSqliteBackup(backupDir: string): Promise<string> {
  await mkdir(backupDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filePath = path.join(backupDir, `${BACKUP_FILE_PREFIX}${timestamp}-${randomSuffix()}${BACKUP_FILE_SUFFIX}`);
  const escapedPath = filePath.replace(/'/g, "''");
  await prisma.$executeRawUnsafe(`VACUUM INTO '${escapedPath}'`);
  return filePath;
}

export async function pruneOldBackups(backupDir: string, retentionCount: number): Promise<string[]> {
  let entries: string[];
  try {
    entries = await readdir(backupDir);
  } catch {
    return [];
  }
  const backups = entries
    .filter((name) => name.startsWith(BACKUP_FILE_PREFIX) && name.endsWith(BACKUP_FILE_SUFFIX))
    .sort() // ISO timestamps in the filename sort chronologically.
    .reverse();

  const toDelete = backups.slice(retentionCount);
  for (const name of toDelete) {
    await unlink(path.join(backupDir, name));
  }
  return toDelete;
}

export async function runScheduledBackup(backupDir: string, retentionCount: number): Promise<string> {
  const filePath = await createSqliteBackup(backupDir);
  await pruneOldBackups(backupDir, retentionCount);
  return filePath;
}
