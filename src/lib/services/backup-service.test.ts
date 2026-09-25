import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "@/lib/test/reset-db";
import { createTask } from "./task-service";
import { recordCompletion } from "./completion-service";
import { getHouseholdSettings } from "./settings-service";
import { createSqliteBackup, exportHouseholdData, importHouseholdData, pruneOldBackups } from "./backup-service";
import type { CompletionRelativeRule } from "@/lib/recurrence";

async function seed() {
  await getHouseholdSettings();
  const area = await prisma.area.create({ data: { name: "Kitchen" } });
  const doug = await prisma.member.create({ data: { name: "Doug" } });
  const rule: CompletionRelativeRule = { type: "COMPLETION_RELATIVE", intervalValue: 7, intervalUnit: "days" };
  const task = await createTask({ name: "Bins", areaId: area.id, recurrenceRule: rule });
  await recordCompletion({ taskId: task.id, memberId: doug.id, completedAt: new Date("2026-09-01T09:00:00Z") });
  return { area, doug, task };
}

beforeEach(async () => {
  await resetDb();
});

describe("export / import round trip", () => {
  it("restores an identical household from an exported bundle", async () => {
    const { task } = await seed();
    const bundle = await exportHouseholdData();

    expect(bundle.tasks).toHaveLength(1);
    expect(bundle.completionEvents).toHaveLength(1);

    await importHouseholdData(JSON.parse(JSON.stringify(bundle)));

    const restoredTask = await prisma.task.findUnique({ where: { id: task.id } });
    expect(restoredTask?.name).toBe("Bins");
    const events = await prisma.completionEvent.findMany();
    expect(events).toHaveLength(1);
    const household = await prisma.household.findUnique({ where: { id: 1 } });
    expect(household).not.toBeNull();
  });

  it("rejects a malformed bundle instead of wiping data", async () => {
    await seed();
    await expect(importHouseholdData({ version: 1, nonsense: true })).rejects.toThrow();
    const tasks = await prisma.task.findMany();
    expect(tasks).toHaveLength(1); // untouched
  });
});

describe("SQLite backup + retention", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "choresome-backup-test-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("creates a readable, consistent snapshot file", async () => {
    await seed();
    const filePath = await createSqliteBackup(dir);
    const files = await readdir(dir);
    expect(files).toContain(path.basename(filePath));
  });

  it("prunes old backups beyond the retention count, keeping the most recent", async () => {
    await seed();
    for (let i = 0; i < 5; i++) {
      await createSqliteBackup(dir);
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    const before = await readdir(dir);
    expect(before).toHaveLength(5);

    await pruneOldBackups(dir, 2);
    const after = (await readdir(dir)).sort();
    expect(after).toHaveLength(2);
    // The two kept should be the two lexically-last (most recent) filenames.
    expect(after).toEqual(before.sort().slice(-2));
  });
});
