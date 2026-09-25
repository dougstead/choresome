import { prisma } from "@/lib/db";
import { calendarDateToUtcDate, instantToCalendarDate, utcDateToCalendarDate } from "@/lib/dates";
import { computeNextDueDate } from "@/lib/recurrence";
import { parseRecurrenceRule } from "@/lib/recurrence/serialize";
import type { RecordCompletionInput, UpdateCompletionInput } from "@/lib/validation/completion";
import { getHouseholdSettings } from "./settings-service";
import { dueDateForNewOrEditedRule } from "./scheduling";

const DUPLICATE_TAP_WINDOW_MS = 5_000;

/** Recomputes a completion-relative task's due date from whichever completion is now chronologically latest. Safe to call unconditionally after any create/edit/delete. */
async function recalculateCompletionRelativeDueDate(taskId: string) {
  const task = await prisma.task.findUniqueOrThrow({ where: { id: taskId } });
  const rule = parseRecurrenceRule(task.recurrenceConfig);
  if (rule.type !== "COMPLETION_RELATIVE") return task;

  const settings = await getHouseholdSettings();
  const latest = await prisma.completionEvent.findFirst({ where: { taskId }, orderBy: { completedAt: "desc" } });
  const nextDue = dueDateForNewOrEditedRule({
    rule,
    fallbackAnchor: instantToCalendarDate(task.createdAt, settings.timezone),
    latestCompletionDate: latest ? instantToCalendarDate(latest.completedAt, settings.timezone) : null,
  });
  return prisma.task.update({ where: { id: taskId }, data: { dueDate: calendarDateToUtcDate(nextDue) } });
}

export async function recordCompletion(input: RecordCompletionInput) {
  const task = await prisma.task.findUniqueOrThrow({ where: { id: input.taskId } });
  const completedAt = input.completedAt ?? new Date();

  const recentDuplicate = await prisma.completionEvent.findFirst({
    where: {
      taskId: input.taskId,
      memberId: input.memberId,
      completedAt: { gte: new Date(completedAt.getTime() - DUPLICATE_TAP_WINDOW_MS) },
    },
    orderBy: { completedAt: "desc" },
  });
  if (recentDuplicate) {
    return { event: recentDuplicate, task, duplicate: true as const };
  }

  const rule = parseRecurrenceRule(task.recurrenceConfig);
  const settings = await getHouseholdSettings();
  const completedOn = instantToCalendarDate(completedAt, settings.timezone);
  const previousDueDate = utcDateToCalendarDate(task.dueDate);
  const nextDue = computeNextDueDate(rule, { completedOn, previousDueDate });

  const [event, updatedTask] = await prisma.$transaction([
    prisma.completionEvent.create({
      data: {
        taskId: input.taskId,
        memberId: input.memberId,
        completedAt,
        note: input.note,
        dueDateAtCompletion: task.dueDate,
      },
      include: { member: true },
    }),
    prisma.task.update({ where: { id: input.taskId }, data: { dueDate: calendarDateToUtcDate(nextDue) } }),
  ]);

  return { event, task: updatedTask, duplicate: false as const };
}

export async function editCompletion(eventId: string, input: UpdateCompletionInput) {
  const existing = await prisma.completionEvent.findUniqueOrThrow({ where: { id: eventId } });

  const event = await prisma.completionEvent.update({
    where: { id: eventId },
    data: {
      ...(input.memberId !== undefined ? { memberId: input.memberId } : {}),
      ...(input.completedAt !== undefined ? { completedAt: input.completedAt } : {}),
      ...(input.note !== undefined ? { note: input.note } : {}),
    },
    include: { member: true },
  });

  // Fixed-calendar schedules are anchored to due dates, not completion timestamps,
  // so editing a completion's details never needs to change the task's due date.
  await recalculateCompletionRelativeDueDate(existing.taskId);

  return event;
}

export async function deleteCompletion(eventId: string) {
  const event = await prisma.completionEvent.findUniqueOrThrow({ where: { id: eventId } });

  const laterOrEqual = await prisma.completionEvent.findFirst({
    where: {
      taskId: event.taskId,
      OR: [
        { completedAt: { gt: event.completedAt } },
        { completedAt: event.completedAt, createdAt: { gt: event.createdAt } },
      ],
    },
  });
  const wasLatest = !laterOrEqual;

  const task = await prisma.task.findUniqueOrThrow({ where: { id: event.taskId } });
  const rule = parseRecurrenceRule(task.recurrenceConfig);

  await prisma.completionEvent.delete({ where: { id: eventId } });

  if (rule.type === "COMPLETION_RELATIVE") {
    const updatedTask = await recalculateCompletionRelativeDueDate(event.taskId);
    return { deletedEvent: event, task: updatedTask };
  }

  if (wasLatest && event.dueDateAtCompletion) {
    const updatedTask = await prisma.task.update({
      where: { id: event.taskId },
      data: { dueDate: event.dueDateAtCompletion },
    });
    return { deletedEvent: event, task: updatedTask };
  }

  return { deletedEvent: event, task };
}

export interface HistoryFilters {
  memberId?: string;
  taskId?: string;
  areaId?: string;
  from?: Date;
  to?: Date;
}

export async function listHistory(filters: HistoryFilters, pagination: { cursor?: string; limit?: number } = {}) {
  const limit = pagination.limit ?? 50;
  const events = await prisma.completionEvent.findMany({
    where: {
      ...(filters.memberId ? { memberId: filters.memberId } : {}),
      ...(filters.taskId ? { taskId: filters.taskId } : {}),
      ...(filters.areaId ? { task: { areaId: filters.areaId } } : {}),
      ...(filters.from || filters.to
        ? { completedAt: { ...(filters.from ? { gte: filters.from } : {}), ...(filters.to ? { lte: filters.to } : {}) } }
        : {}),
    },
    include: { task: { include: { area: true } }, member: true },
    orderBy: [{ completedAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(pagination.cursor ? { cursor: { id: pagination.cursor }, skip: 1 } : {}),
  });

  const hasMore = events.length > limit;
  const page = hasMore ? events.slice(0, limit) : events;
  return { events: page, nextCursor: hasMore ? page[page.length - 1]?.id : null };
}
