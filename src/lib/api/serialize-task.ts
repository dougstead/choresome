import type { Area, Member, Task } from "@prisma/client";
import { calendarDateToIsoDate, utcDateToCalendarDate } from "@/lib/dates";
import { describeRecurrence } from "@/lib/recurrence";
import { parseRecurrenceRule } from "@/lib/recurrence/serialize";
import { reminderConfigSchema } from "@/lib/validation/recurrence";

export type TaskWithRelations = Task & { area: Area; defaultAssignee: Member | null };

export function serializeTask(task: TaskWithRelations) {
  const recurrenceRule = parseRecurrenceRule(task.recurrenceConfig);
  return {
    id: task.id,
    name: task.name,
    description: task.description,
    areaId: task.areaId,
    area: { id: task.area.id, name: task.area.name, icon: task.area.icon },
    active: task.active,
    archivedAt: task.archivedAt,
    recurrenceRule,
    recurrenceSummary: describeRecurrence(recurrenceRule),
    dueDate: calendarDateToIsoDate(utcDateToCalendarDate(task.dueDate)),
    reminderConfig: task.reminderConfig ? reminderConfigSchema.parse(JSON.parse(task.reminderConfig)) : null,
    defaultAssigneeId: task.defaultAssigneeId,
    defaultAssignee: task.defaultAssignee
      ? { id: task.defaultAssignee.id, name: task.defaultAssignee.name, icon: task.defaultAssignee.icon }
      : null,
    estimatedDurationMinutes: task.estimatedDurationMinutes,
    priority: task.priority,
    icon: task.icon,
    shortId: task.shortId,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
}
