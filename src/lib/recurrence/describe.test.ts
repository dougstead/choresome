import { describe, expect, it } from "vitest";
import { describeRecurrence } from "./describe";
import type { CompletionRelativeRule, FixedCalendarRule } from "./types";

describe("describeRecurrence", () => {
  it("describes completion-relative rules in plain language", () => {
    const rule: CompletionRelativeRule = { type: "COMPLETION_RELATIVE", intervalValue: 60, intervalUnit: "days" };
    expect(describeRecurrence(rule)).toBe("Every 60 days after completion");
  });

  it("uses singular units for a value of 1", () => {
    const rule: CompletionRelativeRule = { type: "COMPLETION_RELATIVE", intervalValue: 1, intervalUnit: "weeks" };
    expect(describeRecurrence(rule)).toBe("Every 1 week after completion");
  });

  it("describes a simple weekly rule", () => {
    const rule: FixedCalendarRule = {
      type: "FIXED_CALENDAR",
      pattern: { pattern: "weekly", weekdays: [4], intervalWeeks: 1, anchorDate: { year: 2026, month: 1, day: 1 } },
    };
    expect(describeRecurrence(rule)).toBe("Every Thursday");
  });

  it("describes an every-other-week rule", () => {
    const rule: FixedCalendarRule = {
      type: "FIXED_CALENDAR",
      pattern: { pattern: "weekly", weekdays: [3], intervalWeeks: 2, anchorDate: { year: 2026, month: 1, day: 1 } },
    };
    expect(describeRecurrence(rule)).toBe("Every other Wednesday");
  });

  it("describes a monthly rule with an ordinal day", () => {
    const rule: FixedCalendarRule = {
      type: "FIXED_CALENDAR",
      pattern: { pattern: "monthly", dayOfMonth: 1, intervalMonths: 1, anchorDate: { year: 2026, month: 1, day: 1 } },
    };
    expect(describeRecurrence(rule)).toBe("Monthly, on the 1st");
  });

  it("describes an annual rule", () => {
    const rule: FixedCalendarRule = { type: "FIXED_CALENDAR", pattern: { pattern: "annual", month: 6, day: 3 } };
    expect(describeRecurrence(rule)).toBe("Every year on June 3");
  });
});
