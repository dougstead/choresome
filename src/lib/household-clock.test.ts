import { describe, expect, it, vi } from "vitest";
import { householdToday, householdTodayIso } from "./household-clock";

describe("householdToday", () => {
  it("is the real calendar day when Holiday mode is off", () => {
    vi.setSystemTime(new Date("2026-09-27T12:00:00.000Z"));
    const today = householdToday({ timezone: "UTC", holidayMode: false, holidayStartedAt: null });
    expect(today).toEqual({ year: 2026, month: 9, day: 27 });
    vi.useRealTimers();
  });

  it("is pinned to the day Holiday mode started, not the real day, while it's on", () => {
    vi.setSystemTime(new Date("2026-09-27T12:00:00.000Z"));
    const today = householdToday({
      timezone: "UTC",
      holidayMode: true,
      holidayStartedAt: new Date("2026-09-10T08:00:00.000Z"),
    });
    expect(today).toEqual({ year: 2026, month: 9, day: 10 });
    vi.useRealTimers();
  });

  it("falls back to the real day if Holiday mode is on but has no recorded start (defensive)", () => {
    vi.setSystemTime(new Date("2026-09-27T12:00:00.000Z"));
    const today = householdToday({ timezone: "UTC", holidayMode: true, holidayStartedAt: null });
    expect(today).toEqual({ year: 2026, month: 9, day: 27 });
    vi.useRealTimers();
  });

  it("householdTodayIso formats the same result as an ISO date string", () => {
    vi.setSystemTime(new Date("2026-09-27T12:00:00.000Z"));
    expect(householdTodayIso({ timezone: "UTC", holidayMode: false, holidayStartedAt: null })).toBe("2026-09-27");
    vi.useRealTimers();
  });
});
