import { describe, expect, it } from "vitest";
import { computeDueNotifications, type NotifiableTask } from "./compute-due-notifications";
import { DEFAULT_REMINDER_CONFIG } from "@/lib/validation/recurrence";

const today = { year: 2026, month: 9, day: 25 };
const context = { now: new Date("2026-09-25T12:00:00Z"), today, timeZone: "Europe/London" };

function task(overrides: Partial<NotifiableTask> = {}): NotifiableTask {
  return {
    taskId: "t1",
    taskName: "Clean bathroom",
    areaName: "Bathroom",
    dueDate: today,
    reminderConfig: DEFAULT_REMINDER_CONFIG,
    ...overrides,
  };
}

describe("computeDueNotifications", () => {
  it("fires an overdue notification for a past-due task when onOverdue is set", () => {
    const results = computeDueNotifications(
      [task({ dueDate: { year: 2026, month: 9, day: 20 } })],
      context
    );
    expect(results).toEqual([
      { taskId: "t1", taskName: "Clean bathroom", areaName: "Bathroom", reason: "overdue", daysFromDue: -5 },
    ]);
  });

  it("fires a due-today notification when onDue is set", () => {
    const results = computeDueNotifications([task()], context);
    expect(results.some((r) => r.reason === "due_today")).toBe(true);
  });

  it("does not fire due-today or overdue when the corresponding flag is off", () => {
    const results = computeDueNotifications(
      [task({ reminderConfig: { ...DEFAULT_REMINDER_CONFIG, onDue: false, onOverdue: false } })],
      context
    );
    expect(results).toHaveLength(0);
  });

  it("fires days-before reminders only on the configured day counts", () => {
    const dueInThree = { year: 2026, month: 9, day: 28 };
    const reminderConfig = { ...DEFAULT_REMINDER_CONFIG, daysBefore: [3], onDue: false, onOverdue: false };
    const hits = computeDueNotifications([task({ dueDate: dueInThree, reminderConfig })], context);
    expect(hits).toHaveLength(1);
    expect(hits[0]?.reason).toBe("days_before");

    const dueInTwo = { year: 2026, month: 9, day: 27 };
    const misses = computeDueNotifications([task({ dueDate: dueInTwo, reminderConfig })], context);
    expect(misses).toHaveLength(0);
  });

  it("fires an hours-before reminder within the configured window on the due day", () => {
    const reminderConfig = { ...DEFAULT_REMINDER_CONFIG, onDue: false, hoursBefore: [2] };
    // Due day ends 23:59 Europe/London (BST, UTC+1) = 22:59 UTC. "now" is 22:00 UTC, within 2h of that.
    const lateContext = { now: new Date("2026-09-25T22:00:00Z"), today, timeZone: "Europe/London" };
    const results = computeDueNotifications([task({ reminderConfig })], lateContext);
    expect(results.some((r) => r.reason === "hours_before")).toBe(true);
  });

  it("does not fire an hours-before reminder outside the window", () => {
    const reminderConfig = { ...DEFAULT_REMINDER_CONFIG, onDue: false, hoursBefore: [1] };
    const earlyContext = { now: new Date("2026-09-25T08:00:00Z"), today, timeZone: "Europe/London" };
    const results = computeDueNotifications([task({ reminderConfig })], earlyContext);
    expect(results).toHaveLength(0);
  });

  it("never fires anything for a task that isn't due yet", () => {
    const results = computeDueNotifications(
      [task({ dueDate: { year: 2026, month: 10, day: 15 } })],
      context
    );
    expect(results).toHaveLength(0);
  });
});
