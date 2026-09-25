import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "@/lib/test/reset-db";
import { calendarDateToUtcDate, instantToCalendarDate, utcDateToCalendarDate } from "@/lib/dates";
import { createTask, archiveTask } from "./task-service";
import { deleteCompletion, editCompletion, listHistory, recordCompletion } from "./completion-service";
import { getHouseholdSettings } from "./settings-service";
import type { CompletionRelativeRule, FixedCalendarRule } from "@/lib/recurrence";

async function seed() {
  await getHouseholdSettings();
  const area = await prisma.area.create({ data: { name: "Kitchen" } });
  const doug = await prisma.member.create({ data: { name: "Doug" } });
  const sarah = await prisma.member.create({ data: { name: "Sarah" } });
  return { area, doug, sarah };
}

beforeEach(async () => {
  await resetDb();
});

describe("recordCompletion — completion-relative", () => {
  it("creates a completion event and advances the due date from the actual completion date", async () => {
    const { area, doug } = await seed();
    const rule: CompletionRelativeRule = { type: "COMPLETION_RELATIVE", intervalValue: 7, intervalUnit: "days" };
    const task = await createTask({ name: "Clean bathroom", areaId: area.id, recurrenceRule: rule });

    const completedAt = new Date("2026-09-30T10:00:00.000Z");
    const result = await recordCompletion({ taskId: task.id, memberId: doug.id, completedAt });

    expect(result.duplicate).toBe(false);
    expect(result.event.memberId).toBe(doug.id);
    expect(utcDateToCalendarDate(result.task.dueDate)).toEqual({ year: 2026, month: 10, day: 7 });
  });

  it("preserves every completion event across multiple completions", async () => {
    const { area, doug, sarah } = await seed();
    const rule: CompletionRelativeRule = { type: "COMPLETION_RELATIVE", intervalValue: 7, intervalUnit: "days" };
    const task = await createTask({ name: "Bins", areaId: area.id, recurrenceRule: rule });

    await recordCompletion({ taskId: task.id, memberId: doug.id, completedAt: new Date("2026-09-01T09:00:00Z") });
    await recordCompletion({ taskId: task.id, memberId: sarah.id, completedAt: new Date("2026-09-08T09:00:00Z") });
    await recordCompletion({ taskId: task.id, memberId: doug.id, completedAt: new Date("2026-09-15T09:00:00Z") });

    const events = await prisma.completionEvent.findMany({ where: { taskId: task.id } });
    expect(events).toHaveLength(3);
  });

  it("prevents accidental double-completion from repeated taps", async () => {
    const { area, doug } = await seed();
    const rule: CompletionRelativeRule = { type: "COMPLETION_RELATIVE", intervalValue: 7, intervalUnit: "days" };
    const task = await createTask({ name: "Bins", areaId: area.id, recurrenceRule: rule });

    const first = await recordCompletion({ taskId: task.id, memberId: doug.id });
    const second = await recordCompletion({ taskId: task.id, memberId: doug.id });

    expect(second.duplicate).toBe(true);
    expect(second.event.id).toBe(first.event.id);
    const events = await prisma.completionEvent.findMany({ where: { taskId: task.id } });
    expect(events).toHaveLength(1);
  });

  it("supports a custom dedupe window (e.g. for NFC scans) independent of the default", async () => {
    const { area, doug } = await seed();
    const rule: CompletionRelativeRule = { type: "COMPLETION_RELATIVE", intervalValue: 7, intervalUnit: "days" };
    const task = await createTask({ name: "Bins", areaId: area.id, recurrenceRule: rule });

    const t0 = new Date("2026-09-01T12:00:00Z");
    const within60s = new Date(t0.getTime() + 30_000);
    const after60s = new Date(t0.getTime() + 70_000);

    const first = await recordCompletion({ taskId: task.id, memberId: doug.id, completedAt: t0 }, { dedupeWindowMs: 60_000 });
    const second = await recordCompletion(
      { taskId: task.id, memberId: doug.id, completedAt: within60s },
      { dedupeWindowMs: 60_000 }
    );
    const third = await recordCompletion(
      { taskId: task.id, memberId: doug.id, completedAt: after60s },
      { dedupeWindowMs: 60_000 }
    );

    expect(second.duplicate).toBe(true);
    expect(second.event.id).toBe(first.event.id);
    expect(third.duplicate).toBe(false);
    expect(third.event.id).not.toBe(first.event.id);

    const events = await prisma.completionEvent.findMany({ where: { taskId: task.id } });
    expect(events).toHaveLength(2);
  });

  it("includes member details even on a deduped (duplicate) response", async () => {
    const { area, doug } = await seed();
    const rule: CompletionRelativeRule = { type: "COMPLETION_RELATIVE", intervalValue: 7, intervalUnit: "days" };
    const task = await createTask({ name: "Bins", areaId: area.id, recurrenceRule: rule });

    await recordCompletion({ taskId: task.id, memberId: doug.id });
    const duplicate = await recordCompletion({ taskId: task.id, memberId: doug.id });

    expect(duplicate.duplicate).toBe(true);
    expect(duplicate.event.member?.name).toBe("Doug");
  });
});

describe("recordCompletion — fixed-calendar", () => {
  it("does not permanently shift the schedule when completed late", async () => {
    const { area, doug } = await seed();
    const rule: FixedCalendarRule = {
      type: "FIXED_CALENDAR",
      pattern: { pattern: "weekly", weekdays: [4], intervalWeeks: 1, anchorDate: { year: 2026, month: 9, day: 24 } },
    };
    const task = await createTask({
      name: "Bins out",
      areaId: area.id,
      recurrenceRule: rule,
      startDate: { year: 2026, month: 9, day: 24 },
    });
    expect(utcDateToCalendarDate(task.dueDate)).toEqual({ year: 2026, month: 9, day: 24 });

    // Completed 4 days late.
    const result = await recordCompletion({
      taskId: task.id,
      memberId: doug.id,
      completedAt: new Date("2026-09-28T18:00:00Z"),
    });

    expect(utcDateToCalendarDate(result.task.dueDate)).toEqual({ year: 2026, month: 10, day: 1 });
  });
});

describe("editCompletion", () => {
  it("recalculates the due date for completion-relative tasks when the completion date changes", async () => {
    const { area, doug } = await seed();
    const rule: CompletionRelativeRule = { type: "COMPLETION_RELATIVE", intervalValue: 7, intervalUnit: "days" };
    const task = await createTask({ name: "Bins", areaId: area.id, recurrenceRule: rule });
    const { event } = await recordCompletion({
      taskId: task.id,
      memberId: doug.id,
      completedAt: new Date("2026-09-01T09:00:00Z"),
    });

    await editCompletion(event.id, { completedAt: new Date("2026-09-05T09:00:00Z") });

    const updatedTask = await prisma.task.findUniqueOrThrow({ where: { id: task.id } });
    expect(utcDateToCalendarDate(updatedTask.dueDate)).toEqual({ year: 2026, month: 9, day: 12 });
  });

  it("does not change a fixed-calendar task's due date when correcting a completion's details", async () => {
    const { area, doug } = await seed();
    const rule: FixedCalendarRule = {
      type: "FIXED_CALENDAR",
      pattern: { pattern: "weekly", weekdays: [4], intervalWeeks: 1, anchorDate: { year: 2026, month: 9, day: 24 } },
    };
    const task = await createTask({
      name: "Bins out",
      areaId: area.id,
      recurrenceRule: rule,
      startDate: { year: 2026, month: 9, day: 24 },
    });
    const { event, task: afterComplete } = await recordCompletion({
      taskId: task.id,
      memberId: doug.id,
      completedAt: new Date("2026-09-24T18:00:00Z"),
    });

    await editCompletion(event.id, { note: "actually did this in the morning" });

    const updatedTask = await prisma.task.findUniqueOrThrow({ where: { id: task.id } });
    expect(updatedTask.dueDate).toEqual(afterComplete.dueDate);
  });
});

describe("deleteCompletion — undo/revert", () => {
  it("reverts a fixed-calendar task's due date when the most recent completion is deleted", async () => {
    const { area, doug } = await seed();
    const rule: FixedCalendarRule = {
      type: "FIXED_CALENDAR",
      pattern: { pattern: "weekly", weekdays: [4], intervalWeeks: 1, anchorDate: { year: 2026, month: 9, day: 24 } },
    };
    const task = await createTask({
      name: "Bins out",
      areaId: area.id,
      recurrenceRule: rule,
      startDate: { year: 2026, month: 9, day: 24 },
    });
    const { event } = await recordCompletion({
      taskId: task.id,
      memberId: doug.id,
      completedAt: new Date("2026-09-24T18:00:00Z"),
    });

    const { task: afterDelete } = await deleteCompletion(event.id);
    expect(utcDateToCalendarDate(afterDelete.dueDate)).toEqual({ year: 2026, month: 9, day: 24 });
  });

  it("does not touch the due date when deleting an older, non-latest completion", async () => {
    const { area, doug } = await seed();
    const rule: FixedCalendarRule = {
      type: "FIXED_CALENDAR",
      pattern: { pattern: "weekly", weekdays: [4], intervalWeeks: 1, anchorDate: { year: 2026, month: 9, day: 24 } },
    };
    const task = await createTask({
      name: "Bins out",
      areaId: area.id,
      recurrenceRule: rule,
      startDate: { year: 2026, month: 9, day: 24 },
    });
    const first = await recordCompletion({
      taskId: task.id,
      memberId: doug.id,
      completedAt: new Date("2026-09-24T18:00:00Z"),
    });
    const second = await recordCompletion({
      taskId: task.id,
      memberId: doug.id,
      completedAt: new Date("2026-10-01T18:00:00Z"),
    });
    expect(utcDateToCalendarDate(second.task.dueDate)).toEqual({ year: 2026, month: 10, day: 8 });

    const { task: afterDelete } = await deleteCompletion(first.event.id);
    expect(afterDelete.dueDate).toEqual(second.task.dueDate);
  });

  it("recomputes a completion-relative task's due date from remaining history after a delete", async () => {
    const { area, doug } = await seed();
    const rule: CompletionRelativeRule = { type: "COMPLETION_RELATIVE", intervalValue: 7, intervalUnit: "days" };
    const task = await createTask({ name: "Bins", areaId: area.id, recurrenceRule: rule });
    await recordCompletion({
      taskId: task.id,
      memberId: doug.id,
      completedAt: new Date("2026-09-01T09:00:00Z"),
    });
    const second = await recordCompletion({
      taskId: task.id,
      memberId: doug.id,
      completedAt: new Date("2026-09-08T09:00:00Z"),
    });
    expect(utcDateToCalendarDate(second.task.dueDate)).toEqual({ year: 2026, month: 9, day: 15 });

    const { task: afterDelete } = await deleteCompletion(second.event.id);
    expect(utcDateToCalendarDate(afterDelete.dueDate)).toEqual({ year: 2026, month: 9, day: 8 });
  });

  it("falls back to the task's creation date once all completions are deleted", async () => {
    const { area, doug } = await seed();
    const rule: CompletionRelativeRule = { type: "COMPLETION_RELATIVE", intervalValue: 7, intervalUnit: "days" };
    const task = await createTask({ name: "Bins", areaId: area.id, recurrenceRule: rule });
    const { event } = await recordCompletion({ taskId: task.id, memberId: doug.id });

    const { task: afterDelete } = await deleteCompletion(event.id);
    const settings = await getHouseholdSettings();
    const expected = calendarDateToUtcDate(instantToCalendarDate(task.createdAt, settings.timezone));
    expect(afterDelete.dueDate).toEqual(expected);
  });
});

describe("archived tasks keep their history", () => {
  it("keeps completion history visible after archiving", async () => {
    const { area, doug } = await seed();
    const rule: CompletionRelativeRule = { type: "COMPLETION_RELATIVE", intervalValue: 7, intervalUnit: "days" };
    const task = await createTask({ name: "Descale kettle", areaId: area.id, recurrenceRule: rule });
    await recordCompletion({ taskId: task.id, memberId: doug.id, completedAt: new Date("2026-08-01T09:00:00Z") });
    await archiveTask(task.id);

    const { events } = await listHistory({ taskId: task.id });
    expect(events).toHaveLength(1);
  });
});

describe("listHistory filters", () => {
  it("filters by member, task and date range", async () => {
    const { area, doug, sarah } = await seed();
    const rule: CompletionRelativeRule = { type: "COMPLETION_RELATIVE", intervalValue: 7, intervalUnit: "days" };
    const taskA = await createTask({ name: "Bins", areaId: area.id, recurrenceRule: rule });
    const taskB = await createTask({ name: "Bathroom", areaId: area.id, recurrenceRule: rule });
    await recordCompletion({ taskId: taskA.id, memberId: doug.id, completedAt: new Date("2026-09-01T09:00:00Z") });
    await recordCompletion({ taskId: taskB.id, memberId: sarah.id, completedAt: new Date("2026-09-10T09:00:00Z") });

    const byMember = await listHistory({ memberId: sarah.id });
    expect(byMember.events).toHaveLength(1);
    expect(byMember.events[0]?.taskId).toBe(taskB.id);

    const byTask = await listHistory({ taskId: taskA.id });
    expect(byTask.events).toHaveLength(1);

    const byRange = await listHistory({ from: new Date("2026-09-05T00:00:00Z") });
    expect(byRange.events).toHaveLength(1);
    expect(byRange.events[0]?.taskId).toBe(taskB.id);
  });
});

describe("recordCompletion — joint effort", () => {
  const rule: CompletionRelativeRule = { type: "COMPLETION_RELATIVE", intervalValue: 7, intervalUnit: "days" };

  it("records against one shared system member, created on first use and hidden from member lists", async () => {
    const { area } = await seed();
    const task = await createTask({ name: "Hoover", areaId: area.id, recurrenceRule: rule, allowJoint: true });
    expect(task.allowJoint).toBe(true);

    const first = await recordCompletion({ taskId: task.id, joint: true, completedAt: new Date("2026-09-01T09:00:00Z") });
    const second = await recordCompletion({ taskId: task.id, joint: true, completedAt: new Date("2026-09-10T09:00:00Z") });

    expect(first.event.member.isJoint).toBe(true);
    expect(first.event.member.name).toBe("Joint effort");
    expect(second.event.memberId).toBe(first.event.memberId);
    expect(await prisma.member.count({ where: { isJoint: true } })).toBe(1);

    const { listMembers } = await import("./member-service");
    expect((await listMembers()).map((m) => m.name).sort()).toEqual(["Doug", "Sarah"]);
  });

  it("still advances the schedule like any other completion", async () => {
    const { area } = await seed();
    const task = await createTask({ name: "Hoover", areaId: area.id, recurrenceRule: rule, allowJoint: true });
    const result = await recordCompletion({ taskId: task.id, joint: true, completedAt: new Date("2026-09-30T10:00:00Z") });
    expect(utcDateToCalendarDate(result.task.dueDate)).toEqual({ year: 2026, month: 10, day: 7 });
  });
});
