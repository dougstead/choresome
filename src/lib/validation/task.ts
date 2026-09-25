import { z } from "zod";
import { recurrenceRuleSchema, reminderConfigSchema } from "./recurrence";

export const prioritySchema = z.enum(["LOW", "MEDIUM", "HIGH"]);

export const createTaskSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(2000).optional(),
  areaId: z.string().min(1),
  recurrenceRule: recurrenceRuleSchema,
  /** Optional explicit start date for the recurrence; defaults to today. */
  startDate: z
    .object({ year: z.number().int(), month: z.number().int(), day: z.number().int() })
    .optional(),
  reminderConfig: reminderConfigSchema.nullable().optional(),
  defaultAssigneeId: z.string().min(1).nullable().optional(),
  estimatedDurationMinutes: z.number().int().min(1).max(1440).nullable().optional(),
  priority: prioritySchema.optional(),
  icon: z.string().trim().min(1).max(8).optional(),
});

export const updateTaskSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  areaId: z.string().min(1).optional(),
  recurrenceRule: recurrenceRuleSchema.optional(),
  reminderConfig: reminderConfigSchema.nullable().optional(),
  defaultAssigneeId: z.string().min(1).nullable().optional(),
  estimatedDurationMinutes: z.number().int().min(1).max(1440).nullable().optional(),
  priority: prioritySchema.optional(),
  icon: z.string().trim().min(1).max(8).optional(),
  active: z.boolean().optional(),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
