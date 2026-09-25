import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "@/lib/test/reset-db";
import { utcDateToCalendarDate } from "@/lib/dates";
import { archiveTask, createTask, getTaskByShortId, listTasks, unarchiveTask, updateTask } from "./task-service";
import { recordCompletion } from "./completion-service";
import { getHouseholdSettings } from "./settings-service";
import type { CompletionRelativeRule, FixedCalendarRule } from "@/lib/recurrence";

async function seed() {
  await getHouseholdSettings();
  const area = await prisma.area.create({ data: { name: "Kitchen" } });
  const doug = await prisma.member.create({ data: { name: "Doug" } });
  return { area, doug };
}

beforeEach(async () => {
  await resetDb();
});

describe("createTask", () => {
  it("gives completion-relative tasks a due date of today by default", async () => {
    const { area } = await seed();
    const rule: CompletionRelativeRule = { type: "COMPLETION_RELATIVE", intervalValue: 60, intervalUnit: "days" };
    const task = await createTask({ name: "Clean oven", areaId: area.id, recurrenceRule: rule });
    const settings = await getHouseholdSettings();
    const today = new Date();
    expect(utcDateToCalendarDate(task.dueDate).year).toBe(today.getUTCFullYear());
    expect(settings.timezone).toBeTruthy();
  });

  it("respects an explicit start date", async () => {
    const { area } = await seed();
    const rule: CompletionRelativeRule = { type: "COMPLETION_RELATIVE", intervalValue: 30, intervalUnit: "days" };
    const task = await createTask({
      name: "Clean dishwasher filter",
      areaId: area.id,
      recurrenceRule: rule,
      startDate: { year: 2026, month: 12, day: 1 },
    });
    expect(utcDateToCalendarDate(task.dueDate)).toEqual({ year: 2026, month: 12, day: 1 });
  });

  it("assigns a unique, URL-safe short ID usable via /t/[shortId]", async () => {
    const { area } = await seed();
    const rule: CompletionRelativeRule = { type: "COMPLETION_RELATIVE", intervalValue: 7, intervalUnit: "days" };
    const task = await createTask({ name: "Bins", areaId: area.id, recurrenceRule: rule });
    expect(task.shortId).toMatch(/^[A-Za-z2-9]{8}$/);
    const found = await getTaskByShortId(task.shortId);
    expect(found?.id).toBe(task.id);
  });

  it("jumps fixed-calendar tasks to their next real occurrence", async () => {
    const { area } = await seed();
    const rule: FixedCalendarRule = {
      type: "FIXED_CALENDAR",
      pattern: { pattern: "weekly", weekdays: [4], intervalWeeks: 1, anchorDate: { year: 2026, month: 9, day: 24 } },
    };
    const task = await createTask({
      name: "Bins out",
      areaId: area.id,
      recurrenceRule: rule,
      startDate: { year: 2026, month: 9, day: 25 }, // a Friday
    });
    expect(utcDateToCalendarDate(task.dueDate)).toEqual({ year: 2026, month: 10, day: 1 });
  });
});

describe("updateTask — editing recurrence", () => {
  it("reschedules without altering completion history", async () => {
    const { area, doug } = await seed();
    const rule: CompletionRelativeRule = { type: "COMPLETION_RELATIVE", intervalValue: 7, intervalUnit: "days" };
    const task = await createTask({ name: "Bathroom", areaId: area.id, recurrenceRule: rule });
    const { event } = await recordCompletion({
      taskId: task.id,
      memberId: doug.id,
      completedAt: new Date("2026-09-01T09:00:00Z"),
    });

    const newRule: CompletionRelativeRule = { type: "COMPLETION_RELATIVE", intervalValue: 14, intervalUnit: "days" };
    const updated = await updateTask(task.id, { recurrenceRule: newRule });

    expect(utcDateToCalendarDate(updated.dueDate)).toEqual({ year: 2026, month: 9, day: 15 });
    const unchangedEvent = await prisma.completionEvent.findUniqueOrThrow({ where: { id: event.id } });
    expect(unchangedEvent.completedAt).toEqual(new Date("2026-09-01T09:00:00Z"));
  });
});

describe("archive / unarchive", () => {
  it("excludes archived tasks from the default listing but keeps them retrievable", async () => {
    const { area } = await seed();
    const rule: CompletionRelativeRule = { type: "COMPLETION_RELATIVE", intervalValue: 7, intervalUnit: "days" };
    const task = await createTask({ name: "Old task", areaId: area.id, recurrenceRule: rule });

    await archiveTask(task.id);
    const active = await listTasks();
    expect(active.find((t) => t.id === task.id)).toBeUndefined();

    const withArchived = await listTasks({ includeArchived: true });
    expect(withArchived.find((t) => t.id === task.id)).toBeDefined();

    const restored = await unarchiveTask(task.id);
    expect(restored.active).toBe(true);
  });
});
