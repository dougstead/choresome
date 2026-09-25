import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  calendarDateToInstant,
  compareCalendarDates,
  daysInMonth,
  diffInDays,
  instantToCalendarDate,
  isLeapYear,
  utcDateToCalendarDate,
  calendarDateToUtcDate,
  weekdayOf,
  type CalendarDate,
} from "./dates";

describe("isLeapYear", () => {
  it("handles the standard leap year rules", () => {
    expect(isLeapYear(2024)).toBe(true); // divisible by 4
    expect(isLeapYear(2023)).toBe(false);
    expect(isLeapYear(1900)).toBe(false); // divisible by 100, not 400
    expect(isLeapYear(2000)).toBe(true); // divisible by 400
  });
});

describe("daysInMonth", () => {
  it("returns 29 for February in a leap year", () => {
    expect(daysInMonth(2024, 2)).toBe(29);
  });
  it("returns 28 for February in a non-leap year", () => {
    expect(daysInMonth(2023, 2)).toBe(28);
  });
});

describe("addDays / addWeeks", () => {
  it("crosses month boundaries", () => {
    expect(addDays({ year: 2026, month: 1, day: 30 }, 3)).toEqual({ year: 2026, month: 2, day: 2 });
  });
  it("crosses year boundaries", () => {
    expect(addDays({ year: 2026, month: 12, day: 30 }, 5)).toEqual({ year: 2027, month: 1, day: 4 });
  });
  it("addWeeks is 7x addDays", () => {
    expect(addWeeks({ year: 2026, month: 1, day: 1 }, 2)).toEqual(addDays({ year: 2026, month: 1, day: 1 }, 14));
  });
});

describe("addMonths", () => {
  it("clamps to the last day of a shorter target month", () => {
    expect(addMonths({ year: 2026, month: 1, day: 31 }, 1)).toEqual({ year: 2026, month: 2, day: 28 });
  });
  it("clamps to Feb 29 in a leap year", () => {
    expect(addMonths({ year: 2024, month: 1, day: 31 }, 1)).toEqual({ year: 2024, month: 2, day: 29 });
  });
  it("rolls over into the next year", () => {
    expect(addMonths({ year: 2026, month: 11, day: 15 }, 3)).toEqual({ year: 2027, month: 2, day: 15 });
  });
  it("handles negative amounts", () => {
    expect(addMonths({ year: 2026, month: 1, day: 15 }, -1)).toEqual({ year: 2025, month: 12, day: 15 });
  });
});

describe("addYears", () => {
  it("clamps Feb 29 to Feb 28 when the target year is not a leap year", () => {
    expect(addYears({ year: 2024, month: 2, day: 29 }, 1)).toEqual({ year: 2025, month: 2, day: 28 });
  });
  it("keeps Feb 29 when the target year is also a leap year", () => {
    expect(addYears({ year: 2024, month: 2, day: 29 }, 4)).toEqual({ year: 2028, month: 2, day: 29 });
  });
});

describe("compareCalendarDates / diffInDays", () => {
  it("orders dates correctly", () => {
    const a: CalendarDate = { year: 2026, month: 1, day: 1 };
    const b: CalendarDate = { year: 2026, month: 1, day: 2 };
    expect(compareCalendarDates(a, b)).toBeLessThan(0);
    expect(compareCalendarDates(b, a)).toBeGreaterThan(0);
    expect(compareCalendarDates(a, a)).toBe(0);
  });
  it("computes whole-day differences across a leap day", () => {
    expect(diffInDays({ year: 2024, month: 2, day: 27 }, { year: 2024, month: 3, day: 1 })).toBe(3);
  });
});

describe("weekdayOf", () => {
  it("matches known reference dates", () => {
    // 2026-09-25 is a Friday.
    expect(weekdayOf({ year: 2026, month: 9, day: 25 })).toBe(5);
  });
});

describe("calendarDateToUtcDate / utcDateToCalendarDate", () => {
  it("round-trips", () => {
    const cd: CalendarDate = { year: 2026, month: 3, day: 14 };
    expect(utcDateToCalendarDate(calendarDateToUtcDate(cd))).toEqual(cd);
  });
});

describe("instantToCalendarDate", () => {
  it("resolves the correct local day even when UTC has already rolled over", () => {
    // 2026-09-25T23:30:00Z is still 2026-09-26 early morning in a UTC+... wait,
    // use a west-of-UTC zone where late UTC evening is still the previous day.
    const instant = new Date("2026-09-25T23:30:00.000Z");
    expect(instantToCalendarDate(instant, "America/Los_Angeles")).toEqual({ year: 2026, month: 9, day: 25 });
    expect(instantToCalendarDate(instant, "Pacific/Auckland")).toEqual({ year: 2026, month: 9, day: 26 });
  });

  it("handles a DST transition boundary (UK clocks go back Oct 25 2026)", () => {
    const beforeChange = new Date("2026-10-25T00:30:00.000Z"); // 01:30 BST
    const afterChange = new Date("2026-10-25T01:30:00.000Z"); // 01:30 GMT (post fallback)
    expect(instantToCalendarDate(beforeChange, "Europe/London")).toEqual({ year: 2026, month: 10, day: 25 });
    expect(instantToCalendarDate(afterChange, "Europe/London")).toEqual({ year: 2026, month: 10, day: 25 });
  });
});

describe("calendarDateToInstant", () => {
  it("round-trips with instantToCalendarDate", () => {
    const cd: CalendarDate = { year: 2026, month: 6, day: 15 };
    const instant = calendarDateToInstant(cd, "Europe/London", 12, 0);
    expect(instantToCalendarDate(instant, "Europe/London")).toEqual(cd);
  });

  it("accounts for DST offset (BST is UTC+1 in June)", () => {
    const instant = calendarDateToInstant({ year: 2026, month: 6, day: 15 }, "Europe/London", 12, 0);
    expect(instant.toISOString()).toBe("2026-06-15T11:00:00.000Z");
  });

  it("uses standard time offset outside DST (GMT is UTC+0 in January)", () => {
    const instant = calendarDateToInstant({ year: 2026, month: 1, day: 15 }, "Europe/London", 12, 0);
    expect(instant.toISOString()).toBe("2026-01-15T12:00:00.000Z");
  });
});
