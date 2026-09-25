import type { CalendarDate } from "@/lib/dates";
import { addInterval } from "./completion-relative";
import { nextFixedOccurrenceAfter, nextFixedOccurrenceOnOrAfter } from "./fixed-calendar";
import type { RecurrenceRule } from "./types";

export * from "./types";
export { describeRecurrence } from "./describe";
export { nextFixedOccurrenceAfter, nextFixedOccurrenceOnOrAfter } from "./fixed-calendar";
export { addInterval } from "./completion-relative";

/**
 * The due date a task should be given when it's first created (or when its
 * recurrence rule is edited and it has no completions yet).
 *
 * Completion-relative tasks simply start out due on `from` (typically
 * "today") — they don't force the household to wait out a full interval
 * before something new becomes visible. Fixed-calendar tasks jump straight
 * to their next real occurrence on/after `from`.
 */
export function initialDueDate(rule: RecurrenceRule, from: CalendarDate): CalendarDate {
  if (rule.type === "COMPLETION_RELATIVE") return from;
  return nextFixedOccurrenceOnOrAfter(rule.pattern, from);
}

/**
 * The next due date after a completion is recorded.
 *
 * - COMPLETION_RELATIVE: interval counts from when it was actually completed,
 *   so finishing early or late shifts the whole schedule.
 * - FIXED_CALENDAR: interval counts from the due date that was just
 *   fulfilled, so finishing late does NOT permanently drag the schedule
 *   later (the anchor is `previousDueDate`, never `completedOn`).
 */
export function computeNextDueDate(
  rule: RecurrenceRule,
  ctx: { completedOn: CalendarDate; previousDueDate: CalendarDate }
): CalendarDate {
  if (rule.type === "COMPLETION_RELATIVE") {
    return addInterval(ctx.completedOn, rule.intervalValue, rule.intervalUnit);
  }
  return nextFixedOccurrenceAfter(rule.pattern, ctx.previousDueDate);
}
