import { mkdir, readdir, unlink } from "node:fs/promises";
import path from "node:path";
import { config } from "@/lib/config";
import { randomUUID as createId } from "node:crypto";
import { customAlphabet } from "nanoid";
import { prisma } from "@/lib/db";
import { badRequest } from "@/lib/auth/errors";
import { householdExportBundleSchema, type HouseholdExportBundle } from "@/lib/validation/backup";
import { generateUniqueToken } from "./nfc-tag-service";
import { wipeHouseholdData } from "./tenant";

/** Strips the tenant column: an export describes one household's data, not where it lived. */
function withoutHousehold<T extends { householdId: number }>(row: T): Omit<T, "householdId"> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- dropping the column is the point
  const { householdId, ...rest } = row;
  return rest;
}

export async function exportHouseholdData(householdId: number): Promise<HouseholdExportBundle> {
  const where = { householdId };
  const [household, members, areas, tasks, nfcTags, completionEvents] = await Promise.all([
    prisma.household.findUnique({ where: { id: householdId } }),
    prisma.member.findMany({ where }),
    prisma.area.findMany({ where }),
    prisma.task.findMany({ where }),
    prisma.nfcTag.findMany({ where }),
    prisma.completionEvent.findMany({ where }),
  ]);

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    household,
    members: members.map(withoutHousehold),
    areas: areas.map(withoutHousehold),
    tasks: tasks.map(withoutHousehold),
    nfcTags: nfcTags.map(withoutHousehold),
    completionEvents: completionEvents.map(withoutHousehold),
  };
}

/**
 * Replaces one household's data with the contents of an export, inside one
 * transaction -- other households are never touched.
 *
 * Every row gets a fresh id (with references rewritten to match), because ids
 * are global primary keys: re-using the bundle's ids could collide with rows
 * in another household (e.g. the same export imported twice), and a crafted
 * bundle must never be able to target someone else's rows. NFC tag tokens are
 * kept so physical tags keep working, unless a token is already in use by a
 * different household, in which case that tag gets a new one.
 */
export async function importHouseholdData(householdId: number, rawInput: unknown): Promise<void> {
  const data = householdExportBundleSchema.parse(rawInput);

  const memberIds = new Map(data.members.map((m) => [m.id, createId()]));
  const areaIds = new Map(data.areas.map((a) => [a.id, createId()]));
  const taskIds = new Map(data.tasks.map((t) => [t.id, createId()]));
  const remap = (ids: Map<string, string>, id: string, what: string) => {
    const mapped = ids.get(id);
    if (!mapped) throw badRequest(`Backup file is inconsistent: unknown ${what} ${id}`, "invalid_backup");
    return mapped;
  };

  // Resolve token clashes before the transaction so token generation's own queries don't run inside it.
  const foreignTokens = new Set(
    (
      await prisma.nfcTag.findMany({
        where: { token: { in: data.nfcTags.map((t) => t.token) }, householdId: { not: householdId } },
        select: { token: true },
      })
    ).map((t) => t.token)
  );
  const tokens = new Map<string, string>();
  for (const tag of data.nfcTags) {
    tokens.set(tag.id, foreignTokens.has(tag.token) ? await generateUniqueToken() : tag.token);
  }

  await prisma.$transaction(async (tx) => {
    await wipeHouseholdData(tx, householdId);

    if (data.household) {
      const h = data.household;
      await tx.household.update({
        where: { id: householdId },
        data: {
          name: h.name,
          timezone: h.timezone,
          theme: h.theme,
          dateFormat: h.dateFormat,
          timeFormat: h.timeFormat,
          upcomingWindowDays: h.upcomingWindowDays,
          reminderDefaults: h.reminderDefaults,
          displayConfig: h.displayConfig,
          holidayMode: h.holidayMode,
          holidayStartedAt: h.holidayStartedAt,
        },
      });
    }
    for (const member of data.members) {
      await tx.member.create({ data: { ...member, id: remap(memberIds, member.id, "member"), householdId } });
    }
    for (const area of data.areas) {
      await tx.area.create({ data: { ...area, id: remap(areaIds, area.id, "area"), householdId } });
    }
    for (const task of data.tasks) {
      await tx.task.create({
        data: {
          ...task,
          id: remap(taskIds, task.id, "task"),
          householdId,
          areaId: remap(areaIds, task.areaId, "area"),
          defaultAssigneeId: task.defaultAssigneeId ? remap(memberIds, task.defaultAssigneeId, "member") : null,
        },
      });
    }
    for (const tag of data.nfcTags) {
      await tx.nfcTag.create({
        data: {
          ...tag,
          id: createId(),
          householdId,
          token: tokens.get(tag.id) ?? tag.token,
          taskId: tag.taskId ? remap(taskIds, tag.taskId, "task") : null,
        },
      });
    }
    for (const event of data.completionEvents) {
      await tx.completionEvent.create({
        data: {
          ...event,
          id: createId(),
          householdId,
          taskId: remap(taskIds, event.taskId, "task"),
          memberId: remap(memberIds, event.memberId, "member"),
        },
      });
    }
  });
}

const BACKUP_FILE_PREFIX = "choresome-";
const BACKUP_FILE_SUFFIX = ".db";
const randomSuffix = customAlphabet("23456789abcdefghjkmnpqrstuvwxyz", 4);

/** Server-wide backup directory: BACKUP_DIR if set, else backups/ beside data/ at the project root. */
export function defaultBackupDir(): string {
  return config.backupDir ? path.resolve(config.backupDir) : path.resolve(process.cwd(), "backups");
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
