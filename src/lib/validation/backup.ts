import { z } from "zod";

const householdExportSchema = z.object({
  id: z.number(),
  name: z.string(),
  timezone: z.string(),
  theme: z.enum(["SYSTEM", "LIGHT", "DARK"]),
  dateFormat: z.string(),
  timeFormat: z.string(),
  upcomingWindowDays: z.number(),
  reminderDefaults: z.string(),
  backupDir: z.string().nullable(),
  backupRetention: z.number(),
  backupIntervalHours: z.number(),
  displayConfig: z.string(),
  setupCompleted: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

const memberExportSchema = z.object({
  id: z.string(),
  name: z.string(),
  icon: z.string(),
  color: z.string().nullable(),
  active: z.boolean(),
  order: z.number(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

const areaExportSchema = z.object({
  id: z.string(),
  name: z.string(),
  icon: z.string(),
  order: z.number(),
  archived: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

const taskExportSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  areaId: z.string(),
  active: z.boolean(),
  archivedAt: z.coerce.date().nullable(),
  recurrenceType: z.enum(["COMPLETION_RELATIVE", "FIXED_CALENDAR"]),
  recurrenceConfig: z.string(),
  dueDate: z.coerce.date(),
  reminderConfig: z.string().nullable(),
  defaultAssigneeId: z.string().nullable(),
  estimatedDurationMinutes: z.number().nullable(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]),
  icon: z.string(),
  shortId: z.string(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

const completionEventExportSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  memberId: z.string(),
  completedAt: z.coerce.date(),
  note: z.string().nullable(),
  dueDateAtCompletion: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const householdExportBundleSchema = z.object({
  version: z.literal(1),
  exportedAt: z.string(),
  household: householdExportSchema.nullable(),
  members: z.array(memberExportSchema),
  areas: z.array(areaExportSchema),
  tasks: z.array(taskExportSchema),
  completionEvents: z.array(completionEventExportSchema),
});

export type HouseholdExportBundle = z.infer<typeof householdExportBundleSchema>;
