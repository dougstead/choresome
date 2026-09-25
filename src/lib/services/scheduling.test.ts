import { describe, expect, it } from "vitest";
import { dueDateForNewOrEditedRule } from "./scheduling";
import type { CompletionRelativeRule, FixedCalendarRule } from "@/lib/recurrence";

describe("dueDateForNewOrEditedRule", () => {
  const today = { year: 2026, month: 9, day: 25 };

  it("uses the fallback anchor when nothing has ever been completed (completion-relative)", () => {
    const rule: CompletionRelativeRule = { type: "COMPLETION_RELATIVE", intervalValue: 7, intervalUnit: "days" };
    expect(dueDateForNewOrEditedRule({ rule, fallbackAnchor: today, latestCompletionDate: null })).toEqual(today);
  });

  it("schedules from the most recent completion when history exists (completion-relative)", () => {
    const rule: CompletionRelativeRule = { type: "COMPLETION_RELATIVE", intervalValue: 7, intervalUnit: "days" };
    const latest = { year: 2026, month: 9, day: 20 };
    expect(dueDateForNewOrEditedRule({ rule, fallbackAnchor: today, latestCompletionDate: latest })).toEqual({
      year: 2026,
      month: 9,
      day: 27,
    });
  });

  it("jumps to the next real occurrence on/after the fallback anchor when nothing has been completed (fixed-calendar)", () => {
    const rule: FixedCalendarRule = {
      type: "FIXED_CALENDAR",
      pattern: { pattern: "weekly", weekdays: [4], intervalWeeks: 1, anchorDate: today },
    };
    expect(dueDateForNewOrEditedRule({ rule, fallbackAnchor: today, latestCompletionDate: null })).toEqual({
      year: 2026,
      month: 10,
      day: 1,
    });
  });

  it("reschedules from the last completion under the new rule (fixed-calendar)", () => {
    const rule: FixedCalendarRule = {
      type: "FIXED_CALENDAR",
      pattern: { pattern: "weekly", weekdays: [4], intervalWeeks: 1, anchorDate: today },
    };
    const latest = { year: 2026, month: 9, day: 20 }; // a Sunday
    expect(dueDateForNewOrEditedRule({ rule, fallbackAnchor: today, latestCompletionDate: latest })).toEqual({
      year: 2026,
      month: 9,
      day: 24, // next Thursday strictly after Sept 20
    });
  });
});
