import { execFileSync } from "node:child_process";
import { mkdtemp, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { createTestHousehold, resetDb } from "@/lib/test/reset-db";
import { createTask } from "./task-service";
import { recordCompletion } from "./completion-service";

import { createDatabaseBackup, exportHouseholdData, importHouseholdData, pgDumpConnection, pruneOldBackups } from "./backup-service";
import { createNfcTag, listNfcTags } from "./nfc-tag-service";
import type { CompletionRelativeRule } from "@/lib/recurrence";

async function seed() {
  const area = await prisma.area.create({ data: { householdId: hid, name: "Kitchen" } });
  const doug = await prisma.member.create({ data: { householdId: hid, name: "Doug" } });
  const rule: CompletionRelativeRule = { type: "COMPLETION_RELATIVE", intervalValue: 7, intervalUnit: "days" };
  const task = await createTask(hid, { name: "Bins", areaId: area.id, recurrenceRule: rule });
  await recordCompletion(hid, { taskId: task.id, memberId: doug.id, completedAt: new Date("2026-09-01T09:00:00Z") });
  return { area, doug, task };
}

let hid: number;

beforeEach(async () => {
  await resetDb();
  hid = await createTestHousehold();
});

describe("export / import round trip", () => {
  it("restores an identical household from an exported bundle", async () => {
    const { task } = await seed();
    const bundle = await exportHouseholdData(hid);

    expect(bundle.tasks).toHaveLength(1);
    expect(bundle.completionEvents).toHaveLength(1);

    await importHouseholdData(hid, JSON.parse(JSON.stringify(bundle)));

    // Rows get fresh ids on import (ids are global), with references rewritten to match.
    const restoredTasks = await prisma.task.findMany({ where: { householdId: hid } });
    expect(restoredTasks).toHaveLength(1);
    expect(restoredTasks[0]?.name).toBe("Bins");
    expect(restoredTasks[0]?.id).not.toBe(task.id);
    const events = await prisma.completionEvent.findMany({ include: { task: true, member: true } });
    expect(events).toHaveLength(1);
    expect(events[0]?.taskId).toBe(restoredTasks[0]?.id);
    expect(events[0]?.member.name).toBe("Doug");
    expect(events[0]?.householdId).toBe(hid);
    const household = await prisma.household.findUnique({ where: { id: hid } });
    expect(household).not.toBeNull();
  });

  it("imports into one household without touching another, even from the same bundle twice", async () => {
    await seed();
    const bundle = JSON.parse(JSON.stringify(await exportHouseholdData(hid)));
    const other = await createTestHousehold("Other");
    await createNfcTag(hid, { label: "Sink" });
    const withTag = JSON.parse(JSON.stringify(await exportHouseholdData(hid)));

    await importHouseholdData(other, withTag);
    await importHouseholdData(other, withTag); // re-import replaces, doesn't duplicate

    expect(await prisma.task.count({ where: { householdId: hid } })).toBe(1);
    expect(await prisma.task.count({ where: { householdId: other } })).toBe(1);
    // Same tag token can't live in two households: the imported copy got a fresh one.
    const [original] = await listNfcTags(hid);
    const [copy] = await listNfcTags(other);
    expect(copy?.token).toBeTruthy();
    expect(copy?.token).not.toBe(original?.token);

    // Re-importing into the original household keeps its tag tokens (physical tags keep working).
    await importHouseholdData(hid, withTag);
    const [restored] = await listNfcTags(hid);
    expect(restored?.token).toBe(original?.token);
    expect(bundle.tasks).toHaveLength(1);
  });

  it("rejects a bundle whose references don't line up", async () => {
    await seed();
    const bundle = JSON.parse(JSON.stringify(await exportHouseholdData(hid)));
    bundle.completionEvents[0].memberId = "someone-elses-member";
    await expect(importHouseholdData(hid, bundle)).rejects.toThrow(/inconsistent/);
    expect(await prisma.task.count({ where: { householdId: hid } })).toBe(1); // untouched
  });

  it("rejects a malformed bundle instead of wiping data", async () => {
    await seed();
    await expect(importHouseholdData(hid, { version: 1, nonsense: true })).rejects.toThrow();
    const tasks = await prisma.task.findMany();
    expect(tasks).toHaveLength(1); // untouched
  });
});

function pgDumpAvailable(): boolean {
  try {
    execFileSync(process.env.PG_DUMP_PATH || "pg_dump", ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

describe("pg_dump connection handling", () => {
  it("drops Prisma-only URL parameters and keeps the password out of the arguments", () => {
    const { args, env } = pgDumpConnection(
      "postgresql://app:s%40cret@db.example:5432/choresome?schema=tenant&connection_limit=5&sslmode=require"
    );
    expect(env.PGPASSWORD).toBe("s@cret");
    expect(args).toContain("--schema=tenant");
    const dbname = args.find((a) => a.startsWith("--dbname="))!;
    expect(dbname).not.toContain("cret");
    expect(dbname).not.toContain("connection_limit");
    expect(dbname).not.toContain("schema=");
    expect(dbname).toContain("sslmode=require");
  });
});

describe("database backup + retention", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "choresome-backup-test-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it.skipIf(!pgDumpAvailable())("writes a non-empty pg_dump snapshot", async () => {
    await seed();
    const filePath = await createDatabaseBackup(dir);
    expect(await readdir(dir)).toContain(path.basename(filePath));
    expect((await stat(filePath)).size).toBeGreaterThan(0);
  });

  it("prunes old backups beyond the retention count, keeping the most recent", async () => {
    const names = [1, 2, 3, 4, 5].map((n) => `choresome-2026-10-0${n}T00-00-00-000Z-abcd.dump`);
    for (const name of names) await writeFile(path.join(dir, name), "x");
    await writeFile(path.join(dir, "unrelated.txt"), "x");

    const deleted = await pruneOldBackups(dir, 2);
    expect(deleted.sort()).toEqual(names.slice(0, 3));
    expect((await readdir(dir)).sort()).toEqual([...names.slice(-2), "unrelated.txt"].sort());
  });
});
