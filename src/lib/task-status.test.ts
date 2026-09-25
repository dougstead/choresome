import { describe, expect, it } from "vitest";
import { getTaskStatus } from "./task-status";

describe("getTaskStatus", () => {
  const today = "2026-09-25";

  it("classifies a past due date as overdue", () => {
    expect(getTaskStatus("2026-09-20", today, 3)).toEqual({ status: "overdue", daysFromToday: -5 });
  });

  it("classifies today's date as due today", () => {
    expect(getTaskStatus(today, today, 3)).toEqual({ status: "today", daysFromToday: 0 });
  });

  it("classifies a date within the upcoming window as upcoming", () => {
    expect(getTaskStatus("2026-09-27", today, 3)).toEqual({ status: "upcoming", daysFromToday: 2 });
  });

  it("classifies a date beyond the upcoming window as scheduled", () => {
    expect(getTaskStatus("2026-10-10", today, 3)).toEqual({ status: "scheduled", daysFromToday: 15 });
  });

  it("treats the window boundary as upcoming, not scheduled", () => {
    expect(getTaskStatus("2026-09-28", today, 3).status).toBe("upcoming");
    expect(getTaskStatus("2026-09-29", today, 3).status).toBe("scheduled");
  });
});
