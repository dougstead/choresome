import { recurrenceRuleSchema } from "@/lib/validation/recurrence";
import type { RecurrenceRule } from "./types";

/** Parses + validates a Task's stored `recurrenceConfig` JSON into a RecurrenceRule. */
export function parseRecurrenceRule(recurrenceConfig: string): RecurrenceRule {
  const raw: unknown = JSON.parse(recurrenceConfig);
  return recurrenceRuleSchema.parse(raw);
}

/** Serializes a RecurrenceRule for storage, alongside the denormalized `recurrenceType` column. */
export function serializeRecurrenceRule(rule: RecurrenceRule): { recurrenceType: RecurrenceRule["type"]; recurrenceConfig: string } {
  return { recurrenceType: rule.type, recurrenceConfig: JSON.stringify(rule) };
}
