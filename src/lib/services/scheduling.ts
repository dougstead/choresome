import { isAfter, type CalendarDate } from "@/lib/dates";
import { computeNextDueDate, fixedRuleStartDate, initialDueDate, type RecurrenceRule } from "@/lib/recurrence";

/**
 * Due date to give a task when it's created, or when its recurrence rule is
 * edited. If nothing has ever been completed, this starts a fresh schedule
 * from `fallbackAnchor` (normally "today", or the task's creation date when
 * recomputing after all history has been undone). If something *has* been
 * completed, the new rule is applied as if that most recent completion had
 * just happened under it — giving a sensible schedule without touching any
 * CompletionEvent rows.
 */
export function dueDateForNewOrEditedRule(params: {
  rule: RecurrenceRule;
  fallbackAnchor: CalendarDate;
  latestCompletionDate: CalendarDate | null;
}): CalendarDate {
  if (!params.latestCompletionDate) {
    return initialDueDate(params.rule, params.fallbackAnchor);
  }
  const next = computeNextDueDate(params.rule, {
    completedOn: params.latestCompletionDate,
    previousDueDate: params.latestCompletionDate,
  });
  // A "Starting from" date in the future overrides history: nothing is due before it.
  const start = fixedRuleStartDate(params.rule);
  return start && isAfter(start, next) ? initialDueDate(params.rule, start) : next;
}
