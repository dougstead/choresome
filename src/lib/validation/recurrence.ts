import { z } from "zod";

export const calendarDateSchema = z.object({
  year: z.number().int().min(1970).max(2200),
  month: z.number().int().min(1).max(12),
  day: z.number().int().min(1).max(31),
});

export const intervalUnitSchema = z.enum(["days", "weeks", "months", "years"]);

export const completionRelativeRuleSchema = z.object({
  type: z.literal("COMPLETION_RELATIVE"),
  intervalValue: z.number().int().min(1).max(3650),
  intervalUnit: intervalUnitSchema,
});

export const weeklyPatternSchema = z.object({
  pattern: z.literal("weekly"),
  weekdays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
  intervalWeeks: z.number().int().min(1).max(52),
  anchorDate: calendarDateSchema,
});

export const monthlyPatternSchema = z.object({
  pattern: z.literal("monthly"),
  dayOfMonth: z.number().int().min(1).max(31),
  intervalMonths: z.number().int().min(1).max(24),
  anchorDate: calendarDateSchema,
});

export const annualPatternSchema = z.object({
  pattern: z.literal("annual"),
  month: z.number().int().min(1).max(12),
  day: z.number().int().min(1).max(31),
});

export const fixedCalendarPatternSchema = z.discriminatedUnion("pattern", [
  weeklyPatternSchema,
  monthlyPatternSchema,
  annualPatternSchema,
]);

export const fixedCalendarRuleSchema = z.object({
  type: z.literal("FIXED_CALENDAR"),
  pattern: fixedCalendarPatternSchema,
});

export const recurrenceRuleSchema = z.discriminatedUnion("type", [
  completionRelativeRuleSchema,
  fixedCalendarRuleSchema,
]);

export const reminderConfigSchema = z.object({
  onDue: z.boolean(),
  onOverdue: z.boolean(),
  daysBefore: z.array(z.number().int().min(0).max(365)).max(10),
  hoursBefore: z.array(z.number().int().min(0).max(72)).max(10),
});

export type ReminderConfig = z.infer<typeof reminderConfigSchema>;

export const DEFAULT_REMINDER_CONFIG: ReminderConfig = {
  onDue: true,
  onOverdue: true,
  daysBefore: [],
  hoursBefore: [],
};
