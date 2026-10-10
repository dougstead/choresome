import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { createTestHousehold, resetDb } from "@/lib/test/reset-db";
import { createTask } from "./task-service";
import { recordCompletion } from "./completion-service";

import { getHouseholdStats, getTaskStats } from "./stats-service";
import type { CompletionRelativeRule } from "@/lib/recurrence";

async function seed() {
  const area = await prisma.area.create({ data: { householdId: hid, name: "Kitchen" } });
  const doug = await prisma.member.create({ data: { householdId: hid, name: "Doug" } });
  const sarah = await prisma.member.create({ data: { householdId: hid, name: "Sarah" } });
  return { area, doug, sarah };
}

let hid: number;

beforeEach(async () => {
  await resetDb();
  hid = await createTestHousehold();
});

describe("getTaskStats", () => {
  it("reports a sensible shape for a task that has never been completed", async () => {
    const { area } = await seed();
    const rule: CompletionRelativeRule = { type: "COMPLETION_RELATIVE", intervalValue: 7, intervalUnit: "days" };
    const task = await createTask(hid, { name: "Never done", areaId: area.id, recurrenceRule: rule });

    const stats = await getTaskStats(hid, task.id);
    expect(stats.totalCompletions).toBe(0);
    expect(stats.lastCompletedAt).toBeNull();
    expect(stats.averageIntervalDays).toBeNull();
    expect(stats.currentIntervalDays).toBeNull();
  });

  it("computes counts, averages and per-member breakdowns from real history", async () => {
    const { area, doug, sarah } = await seed();
    const rule: CompletionRelativeRule = { type: "COMPLETION_RELATIVE", intervalValue: 7, intervalUnit: "days" };
    const task = await createTask(hid, { name: "Bathroom", areaId: area.id, recurrenceRule: rule });

    await recordCompletion(hid, { taskId: task.id, memberId: doug.id, completedAt: new Date("2026-08-01T09:00:00Z") });
    await recordCompletion(hid, { taskId: task.id, memberId: sarah.id, completedAt: new Date("2026-08-11T09:00:00Z") });
    await recordCompletion(hid, { taskId: task.id, memberId: doug.id, completedAt: new Date("2026-08-21T09:00:00Z") });

    const stats = await getTaskStats(hid, task.id);
    expect(stats.totalCompletions).toBe(3);
    expect(stats.averageIntervalDays).toBe(10);
    expect(stats.longestIntervalDays).toBe(10);
    const dougStat = stats.completionsByMember.find((m) => m.memberId === doug.id);
    const sarahStat = stats.completionsByMember.find((m) => m.memberId === sarah.id);
    expect(dougStat?.count).toBe(2);
    expect(sarahStat?.count).toBe(1);
    expect(stats.lastCompletedByMemberName).toBe("Doug");
  });
});

describe("getHouseholdStats", () => {
  it("aggregates recent completions by person and area", async () => {
    const { area, doug, sarah } = await seed();
    const bathroomArea = await prisma.area.create({ data: { householdId: hid, name: "Bathroom" } });
    const rule: CompletionRelativeRule = { type: "COMPLETION_RELATIVE", intervalValue: 7, intervalUnit: "days" };
    const kitchenTask = await createTask(hid, { name: "Wipe surfaces", areaId: area.id, recurrenceRule: rule });
    const bathroomTask = await createTask(hid, { name: "Clean bathroom", areaId: bathroomArea.id, recurrenceRule: rule });

    const now = new Date();
    await recordCompletion(hid, { taskId: kitchenTask.id, memberId: doug.id, completedAt: now });
    await recordCompletion(hid, { taskId: bathroomTask.id, memberId: sarah.id, completedAt: now });

    const stats = await getHouseholdStats(hid);
    expect(stats.completedThisWeek).toBeGreaterThanOrEqual(2);
    expect(stats.recentActivity.length).toBeGreaterThanOrEqual(2);
    const person = stats.completionsByPerson.find((p) => p.memberId === doug.id);
    expect(person?.count).toBeGreaterThanOrEqual(1);
  });
});

describe("joint effort in stats", () => {
  it("credits a joint completion to every active member, once each", async () => {
    const { area, doug, sarah } = await seed();
    const rule: CompletionRelativeRule = { type: "COMPLETION_RELATIVE", intervalValue: 7, intervalUnit: "days" };
    const task = await createTask(hid, { name: "Hoover", areaId: area.id, recurrenceRule: rule, allowJoint: true });

    await recordCompletion(hid, { taskId: task.id, memberId: doug.id, completedAt: new Date() });
    await recordCompletion(hid, { taskId: task.id, joint: true, completedAt: new Date(Date.now() + 1000) });

    const perTask = await getTaskStats(hid, task.id);
    expect(perTask.totalCompletions).toBe(2);
    const counts = Object.fromEntries(perTask.completionsByMember.map((c) => [c.memberName, c.count]));
    expect(counts).toEqual({ Doug: 2, Sarah: 1 });
    expect(perTask.lastCompletedByMemberName).toBe("Joint effort");

    const household = await getHouseholdStats(hid);
    expect(household.completedThisMonth).toBe(2); // events, not credits
    const byPerson = Object.fromEntries(household.completionsByPerson.map((c) => [c.memberName, c.count]));
    expect(byPerson).toEqual({ Doug: 2, Sarah: 1 });
    expect(sarah.id).toBeTruthy();
  });
});
