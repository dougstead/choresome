import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { createTestHousehold, resetDb } from "@/lib/test/reset-db";
import { utcDateToCalendarDate } from "@/lib/dates";
import { archiveTask, createTask, listTasks, skipTask, snoozeTask, unarchiveTask, updateTask } from "./task-service";
import { recordCompletion } from "./completion-service";
import { getHouseholdSettings } from "./settings-service";
import type { CompletionRelativeRule, FixedCalendarRule } from "@/lib/recurrence";

async function seed() {
  const area = await prisma.area.create({ data: { householdId: hid, name: "Kitchen" } });
  const doug = await prisma.member.create({ data: { householdId: hid, name: "Doug" } });
  return { area, doug };
}

let hid: number;

beforeEach(async () => {
  await resetDb();
  hid = await createTestHousehold();
});

describe("createTask", () => {
  it("gives completion-relative tasks a due date of today by default", async () => {
    const { area } = await seed();
    const rule: CompletionRelativeRule = { type: "COMPLETION_RELATIVE", intervalValue: 60, intervalUnit: "days" };
    const task = await createTask(hid, { name: "Clean oven", areaId: area.id, recurrenceRule: rule });
    const settings = await getHouseholdSettings(hid);
    const today = new Date();
    expect(utcDateToCalendarDate(task.dueDate).year).toBe(today.getUTCFullYear());
    expect(settings.timezone).toBeTruthy();
  });

  it("respects an explicit start date", async () => {
    const { area } = await seed();
    const rule: CompletionRelativeRule = { type: "COMPLETION_RELATIVE", intervalValue: 30, intervalUnit: "days" };
    const task = await createTask(hid, {
      name: "Clean dishwasher filter",
      areaId: area.id,
      recurrenceRule: rule,
      startDate: { year: 2026, month: 12, day: 1 },
    });
    expect(utcDateToCalendarDate(task.dueDate)).toEqual({ year: 2026, month: 12, day: 1 });
  });

  it("jumps fixed-calendar tasks to their next real occurrence", async () => {
    const { area } = await seed();
    const rule: FixedCalendarRule = {
      type: "FIXED_CALENDAR",
      pattern: { pattern: "weekly", weekdays: [4], intervalWeeks: 1, anchorDate: { year: 2026, month: 9, day: 24 } },
    };
    const task = await createTask(hid, {
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
    const task = await createTask(hid, { name: "Bathroom", areaId: area.id, recurrenceRule: rule });
    const { event } = await recordCompletion(hid, {
      taskId: task.id,
      memberId: doug.id,
      completedAt: new Date("2026-09-01T09:00:00Z"),
    });

    const newRule: CompletionRelativeRule = { type: "COMPLETION_RELATIVE", intervalValue: 14, intervalUnit: "days" };
    const updated = await updateTask(hid, task.id, { recurrenceRule: newRule });

    expect(utcDateToCalendarDate(updated.dueDate)).toEqual({ year: 2026, month: 9, day: 15 });
    const unchangedEvent = await prisma.completionEvent.findUniqueOrThrow({ where: { id: event.id } });
    expect(unchangedEvent.completedAt).toEqual(new Date("2026-09-01T09:00:00Z"));
  });
});

describe("archive / unarchive", () => {
  it("excludes archived tasks from the default listing but keeps them retrievable", async () => {
    const { area } = await seed();
    const rule: CompletionRelativeRule = { type: "COMPLETION_RELATIVE", intervalValue: 7, intervalUnit: "days" };
    const task = await createTask(hid, { name: "Old task", areaId: area.id, recurrenceRule: rule });

    await archiveTask(hid, task.id);
    const active = await listTasks(hid);
    expect(active.find((t) => t.id === task.id)).toBeUndefined();

    const withArchived = await listTasks(hid, { includeArchived: true });
    expect(withArchived.find((t) => t.id === task.id)).toBeDefined();

    const restored = await unarchiveTask(hid, task.id);
    expect(restored.active).toBe(true);
  });
});

describe("skipTask", () => {
  it("advances the due date exactly like a completion would, without recording one", async () => {
    const { area } = await seed();
    const rule: CompletionRelativeRule = { type: "COMPLETION_RELATIVE", intervalValue: 3, intervalUnit: "days" };

    vi.setSystemTime(new Date("2026-09-10T08:00:00.000Z"));
    const task = await createTask(hid, { name: "Water plants", areaId: area.id, recurrenceRule: rule });
    expect(utcDateToCalendarDate(task.dueDate)).toEqual({ year: 2026, month: 9, day: 10 });

    const skipped = await skipTask(hid, task.id);
    expect(utcDateToCalendarDate(skipped.dueDate)).toEqual({ year: 2026, month: 9, day: 13 });

    const events = await prisma.completionEvent.findMany({ where: { taskId: task.id } });
    expect(events).toHaveLength(0);
    vi.useRealTimers();
  });

  it("advances a fixed-calendar task to its next real occurrence, same as completing it would", async () => {
    const { area } = await seed();
    const rule: FixedCalendarRule = {
      type: "FIXED_CALENDAR",
      pattern: { pattern: "weekly", weekdays: [4], intervalWeeks: 1, anchorDate: { year: 2026, month: 9, day: 24 } },
    };

    vi.setSystemTime(new Date("2026-09-24T08:00:00.000Z")); // the anchor Thursday itself
    const task = await createTask(hid, { name: "Bins", areaId: area.id, recurrenceRule: rule });
    expect(utcDateToCalendarDate(task.dueDate)).toEqual({ year: 2026, month: 9, day: 24 });

    const skipped = await skipTask(hid, task.id);
    expect(utcDateToCalendarDate(skipped.dueDate)).toEqual({ year: 2026, month: 10, day: 1 });
    vi.useRealTimers();
  });
});

describe("snoozeTask", () => {
  it("pushes the due date forward by the given number of days, from today", async () => {
    const { area } = await seed();
    const rule: CompletionRelativeRule = { type: "COMPLETION_RELATIVE", intervalValue: 3, intervalUnit: "days" };

    vi.setSystemTime(new Date("2026-09-10T08:00:00.000Z"));
    const task = await createTask(hid, { name: "Water plants", areaId: area.id, recurrenceRule: rule });

    const snoozed = await snoozeTask(hid, task.id, 1);
    expect(utcDateToCalendarDate(snoozed.dueDate)).toEqual({ year: 2026, month: 9, day: 11 });
    vi.useRealTimers();
  });

  it("snoozes from today even when the task is already badly overdue -- not from its old due date", async () => {
    const { area } = await seed();
    const rule: CompletionRelativeRule = { type: "COMPLETION_RELATIVE", intervalValue: 3, intervalUnit: "days" };
    const task = await createTask(hid, {
      name: "Water plants",
      areaId: area.id,
      recurrenceRule: rule,
      startDate: { year: 2020, month: 1, day: 1 }, // ancient, deeply "overdue"
    });

    vi.setSystemTime(new Date("2026-09-10T08:00:00.000Z"));
    const snoozed = await snoozeTask(hid, task.id, 5);
    expect(utcDateToCalendarDate(snoozed.dueDate)).toEqual({ year: 2026, month: 9, day: 15 });
    vi.useRealTimers();
  });
});
