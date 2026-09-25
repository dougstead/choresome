import type { RecurrenceRule } from "@/lib/recurrence";
import type { ReminderConfig } from "@/lib/validation/recurrence";

export interface MemberDto {
  id: string;
  name: string;
  icon: string;
  color: string | null;
  active: boolean;
  order: number;
}

export interface AreaDto {
  id: string;
  name: string;
  icon: string;
  order: number;
  archived: boolean;
}

export interface TaskDto {
  id: string;
  name: string;
  description: string | null;
  areaId: string;
  area: { id: string; name: string; icon: string };
  active: boolean;
  archivedAt: string | null;
  recurrenceRule: RecurrenceRule;
  recurrenceSummary: string;
  dueDate: string; // "YYYY-MM-DD"
  reminderConfig: ReminderConfig | null;
  defaultAssigneeId: string | null;
  defaultAssignee: { id: string; name: string; icon: string } | null;
  estimatedDurationMinutes: number | null;
  priority: "LOW" | "MEDIUM" | "HIGH";
  icon: string;
  shortId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CompletionEventDto {
  id: string;
  taskId: string;
  memberId: string;
  member: MemberDto;
  completedAt: string;
  note: string | null;
  dueDateAtCompletion: string | null;
  createdAt: string;
}

export interface CompletionEventWithTaskDto extends CompletionEventDto {
  task: TaskDto & { area: AreaDto };
}
