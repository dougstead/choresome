import { describe, expect, it } from "vitest";
import { addInterval } from "./completion-relative";

describe("addInterval (completion-relative)", () => {
  it("adds days", () => {
    expect(addInterval({ year: 2026, month: 9, day: 25 }, 60, "days")).toEqual({
      year: 2026,
      month: 11,
      day: 24,
    });
  });

  it("adds weeks", () => {
    expect(addInterval({ year: 2026, month: 9, day: 25 }, 2, "weeks")).toEqual({
      year: 2026,
      month: 10,
      day: 9,
    });
  });

  it("adds months with day clamping", () => {
    expect(addInterval({ year: 2026, month: 1, day: 31 }, 1, "months")).toEqual({
      year: 2026,
      month: 2,
      day: 28,
    });
  });

  it("adds years across a leap day", () => {
    expect(addInterval({ year: 2024, month: 2, day: 29 }, 1, "years")).toEqual({
      year: 2025,
      month: 2,
      day: 28,
    });
  });

  it("counts from whenever completion actually happened, whether early or late", () => {
    // "clean oven every 60 days", due 2026-09-25, but actually done on 2026-09-30 (late).
    const completedLate = { year: 2026, month: 9, day: 30 };
    expect(addInterval(completedLate, 60, "days")).toEqual({ year: 2026, month: 11, day: 29 });

    // Completed early, on 2026-09-20.
    const completedEarly = { year: 2026, month: 9, day: 20 };
    expect(addInterval(completedEarly, 60, "days")).toEqual({ year: 2026, month: 11, day: 19 });
  });
});
