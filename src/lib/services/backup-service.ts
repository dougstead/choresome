import { spawn } from "node:child_process";
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
    // Bulk inserts (one statement per table) keep a years-long history well
    // inside the transaction timeout.
    await tx.member.createMany({
      data: data.members.map((member) => ({ ...member, id: remap(memberIds, member.id, "member"), householdId })),
    });
    await tx.area.createMany({
      data: data.areas.map((area) => ({ ...area, id: remap(areaIds, area.id, "area"), householdId })),
    });
    await tx.task.createMany({
      data: data.tasks.map((task) => ({
        ...task,
        id: remap(taskIds, task.id, "task"),
        householdId,
        areaId: remap(areaIds, task.areaId, "area"),
        defaultAssigneeId: task.defaultAssigneeId ? remap(memberIds, task.defaultAssigneeId, "member") : null,
      })),
    });
    await tx.nfcTag.createMany({
      data: data.nfcTags.map((tag) => ({
        ...tag,
        id: createId(),
        householdId,
        token: tokens.get(tag.id) ?? tag.token,
        taskId: tag.taskId ? remap(taskIds, tag.taskId, "task") : null,
      })),
    });
    await tx.completionEvent.createMany({
      data: data.completionEvents.map((event) => ({
        ...event,
        id: createId(),
        householdId,
        taskId: remap(taskIds, event.taskId, "task"),
        memberId: remap(memberIds, event.memberId, "member"),
      })),
    });
  }, { timeout: 60_000 });
}

const BACKUP_FILE_PREFIX = "choresome-";
const BACKUP_FILE_SUFFIX = ".dump";
const randomSuffix = customAlphabet("23456789abcdefghjkmnpqrstuvwxyz", 4);

export function isBackupFile(name: string): boolean {
  return name.startsWith(BACKUP_FILE_PREFIX) && name.endsWith(BACKUP_FILE_SUFFIX);
}

/** Server-wide backup directory: BACKUP_DIR if set, else backups/ at the project root. */
export function defaultBackupDir(): string {
  return config.backupDir ? path.resolve(config.backupDir) : path.resolve(process.cwd(), "backups");
}

/** Thrown when pg_dump isn't installed, so the scheduler can say so once instead of failing every hour. */
export class PgDumpMissingError extends Error {}

/** Libpq understands these URL parameters; Prisma's own (schema, connection_limit, ...) would make pg_dump reject the URL. */
const LIBPQ_PARAMS = new Set(["sslmode", "sslrootcert", "sslcert", "sslkey", "connect_timeout", "application_name", "options"]);

/**
 * Turns DATABASE_URL into pg_dump arguments + environment: Prisma-only query
 * parameters are dropped (a `schema` becomes `--schema`), and the password
 * moves into PGPASSWORD so it never appears in the process list.
 */
export function pgDumpConnection(databaseUrl: string): { args: string[]; env: Record<string, string> } {
  const url = new URL(databaseUrl);
  const env: Record<string, string> = {};
  if (url.password) {
    env.PGPASSWORD = decodeURIComponent(url.password);
    url.password = "";
  }
  const args: string[] = [];
  for (const key of [...url.searchParams.keys()]) {
    if (key === "schema") args.push(`--schema=${url.searchParams.get(key)}`);
    if (!LIBPQ_PARAMS.has(key)) url.searchParams.delete(key);
  }
  return { args: [...args, `--dbname=${url.toString()}`], env };
}

/**
 * Writes a consistent point-in-time snapshot of the whole database (every
 * household) with `pg_dump --format=custom` -- restorable with
 * `pg_restore --clean --dbname=...`. pg_dump takes a transaction snapshot,
 * so it's safe while the app keeps reading and writing.
 */
export async function createDatabaseBackup(backupDir: string): Promise<string> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is not set");

  await mkdir(backupDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filePath = path.join(backupDir, `${BACKUP_FILE_PREFIX}${timestamp}-${randomSuffix()}${BACKUP_FILE_SUFFIX}`);
  const { args, env } = pgDumpConnection(databaseUrl);

  await new Promise<void>((resolve, reject) => {
    const child = spawn(config.pgDumpPath, ["--format=custom", "--no-owner", "--no-privileges", `--file=${filePath}`, ...args], {
      env: { ...process.env, ...env },
      stdio: ["ignore", "ignore", "pipe"],
    });
    let stderr = "";
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", (err: NodeJS.ErrnoException) =>
      reject(err.code === "ENOENT" ? new PgDumpMissingError(`pg_dump not found (looked for "${config.pgDumpPath}")`) : err)
    );
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`pg_dump exited with code ${code}: ${stderr.trim()}`))));
  }).catch(async (err) => {
    await unlink(filePath).catch(() => undefined);
    throw err;
  });

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
    .filter(isBackupFile)
    .sort() // ISO timestamps in the filename sort chronologically.
    .reverse();

  const toDelete = backups.slice(retentionCount);
  for (const name of toDelete) {
    await unlink(path.join(backupDir, name));
  }
  return toDelete;
}

export async function runScheduledBackup(backupDir: string, retentionCount: number): Promise<string> {
  const filePath = await createDatabaseBackup(backupDir);
  await pruneOldBackups(backupDir, retentionCount);
  return filePath;
}
