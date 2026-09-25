import { describe, expect, it } from "vitest";
import type { CalendarDate } from "@/lib/dates";
import { computeNextDueDate, initialDueDate } from "./index";
import type { CompletionRelativeRule, FixedCalendarRule } from "./types";

describe("initialDueDate", () => {
  it("completion-relative tasks start due immediately", () => {
    const rule: CompletionRelativeRule = { type: "COMPLETION_RELATIVE", intervalValue: 60, intervalUnit: "days" };
    const today: CalendarDate = { year: 2026, month: 9, day: 25 };
    expect(initialDueDate(rule, today)).toEqual(today);
  });

  it("fixed-calendar tasks jump to their first real occurrence on/after today", () => {
    const rule: FixedCalendarRule = {
      type: "FIXED_CALENDAR",
      pattern: { pattern: "weekly", weekdays: [4], intervalWeeks: 1, anchorDate: { year: 2026, month: 9, day: 24 } },
    };
    // Today is Friday 2026-09-25; the next Thursday is 2026-10-01.
    expect(initialDueDate(rule, { year: 2026, month: 9, day: 25 })).toEqual({ year: 2026, month: 10, day: 1 });
  });
});

describe("computeNextDueDate — completion-relative", () => {
  const rule: CompletionRelativeRule = { type: "COMPLETION_RELATIVE", intervalValue: 7, intervalUnit: "days" };
  const previousDueDate: CalendarDate = { year: 2026, month: 9, day: 25 };

  it("completing on time counts from the due date", () => {
    const next = computeNextDueDate(rule, { completedOn: previousDueDate, previousDueDate });
    expect(next).toEqual({ year: 2026, month: 10, day: 2 });
  });

  it("completing late shifts the whole schedule forward from the actual completion date", () => {
    const completedLate: CalendarDate = { year: 2026, month: 9, day: 30 };
    const next = computeNextDueDate(rule, { completedOn: completedLate, previousDueDate });
    expect(next).toEqual({ year: 2026, month: 10, day: 7 });
  });

  it("completing early shifts the schedule earlier too", () => {
    const completedEarly: CalendarDate = { year: 2026, month: 9, day: 20 };
    const next = computeNextDueDate(rule, { completedOn: completedEarly, previousDueDate });
    expect(next).toEqual({ year: 2026, month: 9, day: 27 });
  });
});

describe("computeNextDueDate — fixed-calendar", () => {
  const rule: FixedCalendarRule = {
    type: "FIXED_CALENDAR",
    pattern: { pattern: "weekly", weekdays: [4], intervalWeeks: 1, anchorDate: { year: 2026, month: 9, day: 24 } },
  };
  const previousDueDate: CalendarDate = { year: 2026, month: 9, day: 24 }; // a Thursday

  it("completing on time advances by exactly one occurrence", () => {
    const next = computeNextDueDate(rule, { completedOn: previousDueDate, previousDueDate });
    expect(next).toEqual({ year: 2026, month: 10, day: 1 });
  });

  it("completing late does NOT permanently move the schedule — it's still anchored to the due date", () => {
    const completedLate: CalendarDate = { year: 2026, month: 9, day: 28 }; // done the following Monday
    const next = computeNextDueDate(rule, { completedOn: completedLate, previousDueDate });
    // Next due is still the Thursday after the ORIGINAL due date, not 7 days after the late completion.
    expect(next).toEqual({ year: 2026, month: 10, day: 1 });
  });

  it("completing early also doesn't move the schedule", () => {
    const completedEarly: CalendarDate = { year: 2026, month: 9, day: 22 };
    const next = computeNextDueDate(rule, { completedOn: completedEarly, previousDueDate });
    expect(next).toEqual({ year: 2026, month: 10, day: 1 });
  });
});
