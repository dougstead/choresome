import type { CalendarDate } from "@/lib/dates";

export type IntervalUnit = "days" | "weeks" | "months" | "years";

export interface CompletionRelativeRule {
  type: "COMPLETION_RELATIVE";
  intervalValue: number; // positive integer
  intervalUnit: IntervalUnit;
}

export interface WeeklyPattern {
  pattern: "weekly";
  /** 0 = Sunday .. 6 = Saturday. At least one entry. */
  weekdays: number[];
  /** 1 = every week, 2 = every other week, etc. */
  intervalWeeks: number;
  /** Reference date establishing which week is "week 0" for intervalWeeks > 1. */
  anchorDate: CalendarDate;
}

export interface MonthlyPattern {
  pattern: "monthly";
  /** 1-31; clamped into shorter months. */
  dayOfMonth: number;
  /** 1 = every month, 3 = every 3 months, etc. */
  intervalMonths: number;
  anchorDate: CalendarDate;
}

export interface AnnualPattern {
  pattern: "annual";
  month: number; // 1-12
  day: number; // 1-31 (Feb 29 clamps to Feb 28 in non-leap years)
}

export type FixedCalendarPattern = WeeklyPattern | MonthlyPattern | AnnualPattern;

export interface FixedCalendarRule {
  type: "FIXED_CALENDAR";
  pattern: FixedCalendarPattern;
}

export type RecurrenceRule = CompletionRelativeRule | FixedCalendarRule;
