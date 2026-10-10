import { prisma } from "@/lib/db";
import { calendarDateToUtcDate, instantToCalendarDate, utcDateToCalendarDate } from "@/lib/dates";
import { computeNextDueDate } from "@/lib/recurrence";
import { parseRecurrenceRule } from "@/lib/recurrence/serialize";
import type { RecordCompletionInput, UpdateCompletionInput } from "@/lib/validation/completion";
import { getHouseholdSettings } from "./settings-service";
import { getJointMember } from "./member-service";
import { dueDateForNewOrEditedRule } from "./scheduling";
import { assertMemberInHousehold, findTaskOrThrow } from "./tenant";
import { notFound } from "@/lib/auth/errors";

// Default dedup window for manual completion (dashboard/task-detail double-tap protection).
const DUPLICATE_TAP_WINDOW_MS = 5_000;

// Longer window for NFC/QR scans: a repeated physical tap, an Android NFC re-trigger,
// or a browser reload of the same completion page should collapse into one event.
export const NFC_DEDUPE_WINDOW_MS = 60_000;

/** Recomputes a completion-relative task's due date from whichever completion is now chronologically latest. Safe to call unconditionally after any create/edit/delete. */
async function recalculateCompletionRelativeDueDate(householdId: number, taskId: string) {
  const task = await findTaskOrThrow(householdId, taskId);
  const rule = parseRecurrenceRule(task.recurrenceConfig);
  if (rule.type !== "COMPLETION_RELATIVE") return task;

  const settings = await getHouseholdSettings(householdId);
  const latest = await prisma.completionEvent.findFirst({ where: { taskId }, orderBy: { completedAt: "desc" } });
  const nextDue = dueDateForNewOrEditedRule({
    rule,
    fallbackAnchor: instantToCalendarDate(task.createdAt, settings.timezone),
    latestCompletionDate: latest ? instantToCalendarDate(latest.completedAt, settings.timezone) : null,
  });
  return prisma.task.update({ where: { id: taskId }, data: { dueDate: calendarDateToUtcDate(nextDue) } });
}

export async function recordCompletion(
  householdId: number,
  input: RecordCompletionInput,
  options: { dedupeWindowMs?: number } = {}
) {
  const dedupeWindowMs = options.dedupeWindowMs ?? DUPLICATE_TAP_WINDOW_MS;
  const task = await findTaskOrThrow(householdId, input.taskId);
  const completedAt = input.completedAt ?? new Date();
  const memberId = input.joint ? (await getJointMember(householdId)).id : input.memberId;
  if (!memberId) throw new Error("recordCompletion needs a memberId or joint: true");
  if (!input.joint) await assertMemberInHousehold(householdId, memberId);

  const recentDuplicate = await prisma.completionEvent.findFirst({
    where: {
      taskId: input.taskId,
      memberId,
      completedAt: { gte: new Date(completedAt.getTime() - dedupeWindowMs) },
    },
    orderBy: { completedAt: "desc" },
    include: { member: true },
  });
  if (recentDuplicate) {
    return { event: recentDuplicate, task, duplicate: true as const };
  }

  const rule = parseRecurrenceRule(task.recurrenceConfig);
  const settings = await getHouseholdSettings(householdId);
  const completedOn = instantToCalendarDate(completedAt, settings.timezone);
  const previousDueDate = utcDateToCalendarDate(task.dueDate);
  const nextDue = computeNextDueDate(rule, { completedOn, previousDueDate });

  const [event, updatedTask] = await prisma.$transaction([
    prisma.completionEvent.create({
      data: {
        householdId,
        taskId: input.taskId,
        memberId,
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

async function findCompletionOrThrow(householdId: number, eventId: string) {
  const event = await prisma.completionEvent.findFirst({ where: { id: eventId, householdId } });
  if (!event) throw notFound("Completion not found");
  return event;
}

export async function editCompletion(householdId: number, eventId: string, input: UpdateCompletionInput) {
  const existing = await findCompletionOrThrow(householdId, eventId);
  if (input.memberId !== undefined) await assertMemberInHousehold(householdId, input.memberId);

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
  await recalculateCompletionRelativeDueDate(householdId, existing.taskId);

  return event;
}

export async function deleteCompletion(householdId: number, eventId: string) {
  const event = await findCompletionOrThrow(householdId, eventId);

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
    const updatedTask = await recalculateCompletionRelativeDueDate(householdId, event.taskId);
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

export async function listHistory(
  householdId: number,
  filters: HistoryFilters,
  pagination: { cursor?: string; limit?: number } = {}
) {
  const limit = Math.min(Math.max(1, pagination.limit ?? 50), 200);
  // A cursor id from another household would still be filtered out by
  // householdId, but reject it so pagination can never be anchored on (and
  // thereby probe for the existence of) someone else's row.
  if (pagination.cursor) await findCompletionOrThrow(householdId, pagination.cursor);
  const events = await prisma.completionEvent.findMany({
    where: {
      householdId,
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
