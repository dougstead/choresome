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

describe("initialDueDate — 'Starting from' date", () => {
  // Bin day is Wednesday. General waste is fortnightly, starting Wed 2026-10-07.
  const general: FixedCalendarRule = {
    type: "FIXED_CALENDAR",
    pattern: { pattern: "weekly", weekdays: [3], intervalWeeks: 2, anchorDate: { year: 2026, month: 10, day: 7 } },
  };

  it("a future start date is the first due date, even if other Wednesdays come sooner", () => {
    // Today is Fri 2026-09-25; Wed 09-30 would be sooner but is in an 'off' week AND before the start.
    expect(initialDueDate(general, { year: 2026, month: 9, day: 25 })).toEqual({ year: 2026, month: 10, day: 7 });
  });

  it("a past start date keeps its week parity: only every second Wednesday counts", () => {
    // Started Wed 09-09 (an 'on' week). Today Fri 09-25 -> 09-23 is 'on', 09-30 is 'off'... next 'on' is 10-07.
    const rule: FixedCalendarRule = {
      type: "FIXED_CALENDAR",
      pattern: { pattern: "weekly", weekdays: [3], intervalWeeks: 2, anchorDate: { year: 2026, month: 9, day: 9 } },
    };
    expect(initialDueDate(rule, { year: 2026, month: 9, day: 25 })).toEqual({ year: 2026, month: 10, day: 7 });
  });

  it("completing a fortnightly task schedules the next one two weeks later", () => {
    const due = { year: 2026, month: 10, day: 7 };
    expect(computeNextDueDate(general, { completedOn: due, previousDueDate: due })).toEqual({ year: 2026, month: 10, day: 21 });
  });
});
