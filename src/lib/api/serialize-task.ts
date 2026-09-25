import type { Area, Member, Task } from "@prisma/client";
import { calendarDateToIsoDate, utcDateToCalendarDate } from "@/lib/dates";
import { describeRecurrence } from "@/lib/recurrence";
import { parseRecurrenceRule } from "@/lib/recurrence/serialize";
import { reminderConfigSchema } from "@/lib/validation/recurrence";

export type TaskWithRelations = Task & { area: Area; defaultAssignee: Member | null };

// Dates are converted to ISO strings here (rather than left as Date objects)
// so this shape is identical whether it's JSON-serialized for an API route
// or passed directly as a prop from a Server to a Client Component — React's
// RSC wire format would otherwise preserve real Date instances in the latter
// case, silently diverging from the TaskDto contract client code relies on.
export function serializeTask(task: TaskWithRelations) {
  const recurrenceRule = parseRecurrenceRule(task.recurrenceConfig);
  return {
    id: task.id,
    name: task.name,
    description: task.description,
    areaId: task.areaId,
    area: { id: task.area.id, name: task.area.name, icon: task.area.icon },
    active: task.active,
    archivedAt: task.archivedAt ? task.archivedAt.toISOString() : null,
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
    allowJoint: task.allowJoint,
    icon: task.icon,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}
