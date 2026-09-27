import { calendarDateToIsoDate, instantToCalendarDate, type CalendarDate } from "@/lib/dates";

/** The bits of HouseholdSettings that determine "today" -- kept narrow so callers can pass either the full settings object or a minimal stand-in (e.g. in tests). */
export interface HouseholdClockSettings {
  timezone: string;
  holidayMode: boolean;
  holidayStartedAt: Date | null;
}

/**
 * "Today", for every due-date/status calculation in the app.
 *
 * Normally just the real calendar day in the household's timezone. But while
 * Holiday mode is on, it's pinned to the day Holiday mode was switched on, so
 * nothing creeps further overdue while everyone's away -- turning Holiday
 * mode back off is what actually advances schedules again, by shifting every
 * active task's due date forward by however many days were paused (see
 * `setHolidayMode` in holiday-service.ts). Using this one helper everywhere
 * `todayIso` used to be computed directly keeps that freeze consistent across
 * the dashboard, area views, task detail, stats and the wall display.
 */
export function householdToday(settings: HouseholdClockSettings): CalendarDate {
  if (settings.holidayMode && settings.holidayStartedAt) {
    return instantToCalendarDate(settings.holidayStartedAt, settings.timezone);
  }
  return instantToCalendarDate(new Date(), settings.timezone);
}

export function householdTodayIso(settings: HouseholdClockSettings): string {
  return calendarDateToIsoDate(householdToday(settings));
}
