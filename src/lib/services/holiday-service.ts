import { prisma } from "@/lib/db";
import { addDays, calendarDateToUtcDate, diffInDays, instantToCalendarDate, utcDateToCalendarDate } from "@/lib/dates";
import { getHouseholdSettings } from "./settings-service";

const HOUSEHOLD_ID = 1;

export interface HolidayModeResult {
  holidayMode: boolean;
  holidayStartedAt: Date | null;
  /** Days the household was away, computed only when turning Holiday mode off. */
  daysPaused: number;
  /** How many active tasks had their due date shifted forward. */
  tasksShifted: number;
}

/**
 * Turns Holiday mode on or off.
 *
 * On: just records when it started -- `householdToday()` then pins every
 * due-date calculation to that day until it's turned off, so nothing creeps
 * further overdue while the household is away.
 *
 * Off: the actual "resume" step. Every active task's due date is shifted
 * forward by exactly how many days Holiday mode was on, which preserves
 * each task's relative overdue/due-in-N-days position from the moment
 * Holiday mode started -- a task that was already overdue when the holiday
 * began is still exactly as overdue afterwards, and one that wasn't is
 * still due on schedule, just later.
 */
export async function setHolidayMode(enabled: boolean): Promise<HolidayModeResult> {
  const settings = await getHouseholdSettings();

  if (enabled) {
    if (settings.holidayMode) {
      // Already on -- idempotent, and keep the original start date rather than resetting it.
      return { holidayMode: true, holidayStartedAt: settings.holidayStartedAt, daysPaused: 0, tasksShifted: 0 };
    }
    const startedAt = new Date();
    await prisma.household.update({ where: { id: HOUSEHOLD_ID }, data: { holidayMode: true, holidayStartedAt: startedAt } });
    return { holidayMode: true, holidayStartedAt: startedAt, daysPaused: 0, tasksShifted: 0 };
  }

  if (!settings.holidayMode || !settings.holidayStartedAt) {
    return { holidayMode: false, holidayStartedAt: null, daysPaused: 0, tasksShifted: 0 };
  }

  const startedOn = instantToCalendarDate(settings.holidayStartedAt, settings.timezone);
  const today = instantToCalendarDate(new Date(), settings.timezone);
  const daysPaused = Math.max(0, diffInDays(startedOn, today));

  const tasksShifted = await prisma.$transaction(async (tx) => {
    let shifted = 0;
    if (daysPaused > 0) {
      const activeTasks = await tx.task.findMany({ where: { active: true }, select: { id: true, dueDate: true } });
      for (const task of activeTasks) {
        const newDueDate = addDays(utcDateToCalendarDate(task.dueDate), daysPaused);
        await tx.task.update({ where: { id: task.id }, data: { dueDate: calendarDateToUtcDate(newDueDate) } });
      }
      shifted = activeTasks.length;
    }
    await tx.household.update({ where: { id: HOUSEHOLD_ID }, data: { holidayMode: false, holidayStartedAt: null } });
    return shifted;
  });

  return { holidayMode: false, holidayStartedAt: null, daysPaused, tasksShifted };
}
