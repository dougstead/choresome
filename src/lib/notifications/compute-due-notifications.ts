import { calendarDateToInstant, diffInDays, type CalendarDate } from "@/lib/dates";
import type { ReminderConfig } from "@/lib/validation/recurrence";
import type { DueNotification } from "./types";

export interface NotifiableTask {
  taskId: string;
  taskName: string;
  areaName: string;
  dueDate: CalendarDate;
  reminderConfig: ReminderConfig;
}

/**
 * Pure decision logic: given the current moment and a task's due date +
 * reminder settings, which reminder conditions are currently true?
 * `daysBefore`/`hoursBefore` are evaluated independently, so more than one
 * DueNotification can come back for the same task on the same check — the
 * caller is responsible for not re-showing one it already delivered today.
 */
export function computeDueNotifications(
  tasks: NotifiableTask[],
  context: { now: Date; today: CalendarDate; timeZone: string }
): DueNotification[] {
  const results: DueNotification[] = [];

  for (const task of tasks) {
    const daysUntilDue = diffInDays(context.today, task.dueDate);
    const base = { taskId: task.taskId, taskName: task.taskName, areaName: task.areaName };

    if (daysUntilDue < 0 && task.reminderConfig.onOverdue) {
      results.push({ ...base, reason: "overdue", daysFromDue: daysUntilDue });
    }

    if (daysUntilDue === 0 && task.reminderConfig.onDue) {
      results.push({ ...base, reason: "due_today", daysFromDue: 0 });
    }

    if (daysUntilDue > 0 && task.reminderConfig.daysBefore.includes(daysUntilDue)) {
      results.push({ ...base, reason: "days_before", daysFromDue: daysUntilDue });
    }

    if (daysUntilDue === 0) {
      const endOfDueDay = calendarDateToInstant(task.dueDate, context.timeZone, 23, 59);
      for (const hours of task.reminderConfig.hoursBefore) {
        const windowStart = new Date(endOfDueDay.getTime() - hours * 3_600_000);
        if (context.now >= windowStart && context.now < endOfDueDay) {
          results.push({ ...base, reason: "hours_before", daysFromDue: 0 });
          break;
        }
      }
    }
  }

  return results;
}
