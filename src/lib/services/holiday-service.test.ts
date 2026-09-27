import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "@/lib/test/reset-db";
import { utcDateToCalendarDate } from "@/lib/dates";
import { createTask } from "./task-service";
import { setHolidayMode } from "./holiday-service";
import { getHouseholdSettings } from "./settings-service";
import type { CompletionRelativeRule, FixedCalendarRule } from "@/lib/recurrence";

async function seed() {
  await getHouseholdSettings();
  const area = await prisma.area.create({ data: { name: "Kitchen" } });
  return { area };
}

beforeEach(async () => {
  await resetDb();
});

describe("setHolidayMode", () => {
  it("turning it on just records the start time -- it doesn't touch any task", async () => {
    const { area } = await seed();
    const rule: CompletionRelativeRule = { type: "COMPLETION_RELATIVE", intervalValue: 3, intervalUnit: "days" };
    const task = await createTask({ name: "Water plants", areaId: area.id, recurrenceRule: rule });
    const dueBefore = task.dueDate.getTime();

    const result = await setHolidayMode(true);
    expect(result.holidayMode).toBe(true);
    expect(result.holidayStartedAt).not.toBeNull();

    const settings = await getHouseholdSettings();
    expect(settings.holidayMode).toBe(true);

    const unchanged = await prisma.task.findUniqueOrThrow({ where: { id: task.id } });
    expect(unchanged.dueDate.getTime()).toBe(dueBefore);
  });

  it("is idempotent -- turning it on again keeps the original start date", async () => {
    await seed();
    vi.setSystemTime(new Date("2026-09-10T08:00:00.000Z"));
    const first = await setHolidayMode(true);

    vi.setSystemTime(new Date("2026-09-15T08:00:00.000Z"));
    const second = await setHolidayMode(true);

    expect(second.holidayStartedAt?.toISOString()).toBe(first.holidayStartedAt?.toISOString());
    vi.useRealTimers();
  });

  it("turning it off shifts every active task's due date forward by the number of days paused", async () => {
    const { area } = await seed();
    const relative: CompletionRelativeRule = { type: "COMPLETION_RELATIVE", intervalValue: 3, intervalUnit: "days" };
    const fixed: FixedCalendarRule = {
      type: "FIXED_CALENDAR",
      pattern: { pattern: "weekly", weekdays: [2], intervalWeeks: 1, anchorDate: { year: 2026, month: 9, day: 8 } },
    };

    vi.setSystemTime(new Date("2026-09-10T08:00:00.000Z")); // a Thursday
    const notYetDue = await createTask({ name: "Water plants", areaId: area.id, recurrenceRule: relative });
    const bins = await createTask({ name: "Bins", areaId: area.id, recurrenceRule: fixed });

    // Something already overdue before the holiday even starts -- it should
    // stay exactly as overdue afterwards, not get a free pass.
    const overdueAlready = await createTask({ name: "Descale kettle", areaId: area.id, recurrenceRule: relative });
    await prisma.task.update({
      where: { id: overdueAlready.id },
      data: { dueDate: new Date("2026-09-05T00:00:00.000Z") },
    });

    await setHolidayMode(true);

    // 10 days pass while away.
    vi.setSystemTime(new Date("2026-09-20T08:00:00.000Z"));
    const result = await setHolidayMode(false);

    expect(result.holidayMode).toBe(false);
    expect(result.daysPaused).toBe(10);
    expect(result.tasksShifted).toBe(3);

    const settings = await getHouseholdSettings();
    expect(settings.holidayMode).toBe(false);
    expect(settings.holidayStartedAt).toBeNull();

    const updatedRelative = await prisma.task.findUniqueOrThrow({ where: { id: notYetDue.id } });
    expect(utcDateToCalendarDate(updatedRelative.dueDate)).toEqual({ year: 2026, month: 9, day: 20 });

    const updatedFixed = await prisma.task.findUniqueOrThrow({ where: { id: bins.id } });
    expect(utcDateToCalendarDate(updatedFixed.dueDate)).toEqual({ year: 2026, month: 9, day: 25 });

    // Was 5 days overdue on Sept 10 (holiday start); after the 10-day shift
    // and 10 real days elapsing, it's still exactly 5 days overdue.
    const updatedOverdue = await prisma.task.findUniqueOrThrow({ where: { id: overdueAlready.id } });
    expect(utcDateToCalendarDate(updatedOverdue.dueDate)).toEqual({ year: 2026, month: 9, day: 15 });

    vi.useRealTimers();
  });

  it("does nothing if turned off the same day it started, or if it was never on", async () => {
    await seed();
    const neverOn = await setHolidayMode(false);
    expect(neverOn).toEqual({ holidayMode: false, holidayStartedAt: null, daysPaused: 0, tasksShifted: 0 });

    await setHolidayMode(true);
    const sameDay = await setHolidayMode(false);
    expect(sameDay.daysPaused).toBe(0);
    expect(sameDay.tasksShifted).toBe(0);
  });
});
