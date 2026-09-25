import { describe, expect, it } from "vitest";
import { weekdayOf, type CalendarDate } from "@/lib/dates";
import { nextFixedOccurrenceAfter, nextFixedOccurrenceOnOrAfter } from "./fixed-calendar";
import type { AnnualPattern, MonthlyPattern, WeeklyPattern } from "./types";

const THURSDAY: CalendarDate = { year: 2026, month: 9, day: 24 };
const WEDNESDAY: CalendarDate = { year: 2026, month: 9, day: 23 };

describe("weekly fixed-calendar recurrence", () => {
  it("sanity-checks the fixture weekdays", () => {
    expect(weekdayOf(THURSDAY)).toBe(4);
    expect(weekdayOf(WEDNESDAY)).toBe(3);
  });

  it("every week: next occurrence is exactly 7 days later", () => {
    const pattern: WeeklyPattern = { pattern: "weekly", weekdays: [4], intervalWeeks: 1, anchorDate: THURSDAY };
    expect(nextFixedOccurrenceAfter(pattern, THURSDAY)).toEqual({ year: 2026, month: 10, day: 1 });
  });

  it("every other week: skips the in-between week", () => {
    // "recycling every other Wednesday", anchored on WEDNESDAY (an "on" week).
    const pattern: WeeklyPattern = { pattern: "weekly", weekdays: [3], intervalWeeks: 2, anchorDate: WEDNESDAY };
    const next = nextFixedOccurrenceAfter(pattern, WEDNESDAY);
    expect(next).toEqual({ year: 2026, month: 10, day: 7 }); // +14 days, not +7
    const following = nextFixedOccurrenceAfter(pattern, next);
    expect(following).toEqual({ year: 2026, month: 10, day: 21 });
  });

  it("multiple weekdays in one rule: alternates within the same week before jumping", () => {
    // Tue (2) and Thu (4), every week. From Tuesday 2026-09-22, next should be Thursday 2026-09-24.
    const tuesday: CalendarDate = { year: 2026, month: 9, day: 22 };
    const pattern: WeeklyPattern = { pattern: "weekly", weekdays: [2, 4], intervalWeeks: 1, anchorDate: tuesday };
    expect(nextFixedOccurrenceAfter(pattern, tuesday)).toEqual(THURSDAY);
    expect(nextFixedOccurrenceAfter(pattern, THURSDAY)).toEqual({ year: 2026, month: 9, day: 29 });
  });

  it("onOrAfter returns the same date when it already matches", () => {
    const pattern: WeeklyPattern = { pattern: "weekly", weekdays: [4], intervalWeeks: 1, anchorDate: THURSDAY };
    expect(nextFixedOccurrenceOnOrAfter(pattern, THURSDAY)).toEqual(THURSDAY);
  });
});

describe("monthly fixed-calendar recurrence", () => {
  it("clamps into short months and un-clamps once the month is long enough again", () => {
    const anchor: CalendarDate = { year: 2026, month: 1, day: 31 };
    const pattern: MonthlyPattern = { pattern: "monthly", dayOfMonth: 31, intervalMonths: 1, anchorDate: anchor };
    // Jan 31 -> Feb (clamped to 28, 2026 is not a leap year) -> Mar 31 (un-clamped).
    const feb = nextFixedOccurrenceAfter(pattern, anchor);
    expect(feb).toEqual({ year: 2026, month: 2, day: 28 });
    const mar = nextFixedOccurrenceAfter(pattern, feb);
    expect(mar).toEqual({ year: 2026, month: 3, day: 31 });
  });

  it("supports quarterly (every 3 months) schedules", () => {
    const anchor: CalendarDate = { year: 2026, month: 1, day: 15 };
    const pattern: MonthlyPattern = { pattern: "monthly", dayOfMonth: 15, intervalMonths: 3, anchorDate: anchor };
    expect(nextFixedOccurrenceAfter(pattern, anchor)).toEqual({ year: 2026, month: 4, day: 15 });
    expect(nextFixedOccurrenceAfter(pattern, { year: 2026, month: 4, day: 15 })).toEqual({
      year: 2026,
      month: 7,
      day: 15,
    });
  });

  it("rolls over year boundaries", () => {
    const anchor: CalendarDate = { year: 2026, month: 11, day: 30 };
    const pattern: MonthlyPattern = { pattern: "monthly", dayOfMonth: 30, intervalMonths: 1, anchorDate: anchor };
    const dec = nextFixedOccurrenceAfter(pattern, anchor);
    expect(dec).toEqual({ year: 2026, month: 12, day: 30 });
    const jan = nextFixedOccurrenceAfter(pattern, dec);
    expect(jan).toEqual({ year: 2027, month: 1, day: 30 });
  });
});

describe("annual fixed-calendar recurrence", () => {
  it("repeats on the same month/day each year", () => {
    const pattern: AnnualPattern = { pattern: "annual", month: 3, day: 15 };
    expect(nextFixedOccurrenceAfter(pattern, { year: 2026, month: 3, day: 15 })).toEqual({
      year: 2027,
      month: 3,
      day: 15,
    });
  });

  it("clamps Feb 29 to Feb 28 in non-leap years, and un-clamps in leap years", () => {
    const pattern: AnnualPattern = { pattern: "annual", month: 2, day: 29 };
    const y2025 = nextFixedOccurrenceAfter(pattern, { year: 2024, month: 2, day: 29 });
    expect(y2025).toEqual({ year: 2025, month: 2, day: 28 });
    const y2026 = nextFixedOccurrenceAfter(pattern, y2025);
    expect(y2026).toEqual({ year: 2026, month: 2, day: 28 });
    const y2027 = nextFixedOccurrenceAfter(pattern, y2026);
    expect(y2027).toEqual({ year: 2027, month: 2, day: 28 });
    const y2028 = nextFixedOccurrenceAfter(pattern, y2027);
    expect(y2028).toEqual({ year: 2028, month: 2, day: 29 }); // 2028 is a leap year
  });
});
