import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  addDays,
  calendarDateToUtcDate,
  instantToCalendarDate,
  utcDateToCalendarDate,
  type CalendarDate,
} from "@/lib/dates";
import { computeNextDueDate } from "@/lib/recurrence";
import { parseRecurrenceRule, serializeRecurrenceRule } from "@/lib/recurrence/serialize";
import { householdToday } from "@/lib/household-clock";
import { getHouseholdSettings } from "./settings-service";
import { dueDateForNewOrEditedRule } from "./scheduling";
import { assertAreaInHousehold, assertMemberInHousehold, findTaskOrThrow } from "./tenant";
import type { CreateTaskInput, UpdateTaskInput } from "@/lib/validation/task";

export async function listTasks(householdId: number, options: { includeArchived?: boolean; areaId?: string } = {}) {
  return prisma.task.findMany({
    where: {
      householdId,
      ...(options.includeArchived ? {} : { active: true }),
      ...(options.areaId ? { areaId: options.areaId } : {}),
    },
    include: { area: true, defaultAssignee: true },
    orderBy: { dueDate: "asc" },
  });
}

export async function getTaskById(householdId: number, id: string) {
  return prisma.task.findFirst({
    where: { id, householdId },
    include: { area: true, defaultAssignee: true },
  });
}

export async function createTask(householdId: number, input: CreateTaskInput) {
  await assertAreaInHousehold(householdId, input.areaId);
  if (input.defaultAssigneeId) await assertMemberInHousehold(householdId, input.defaultAssigneeId);
  const settings = await getHouseholdSettings(householdId);
  const today = householdToday(settings);
  const startFrom: CalendarDate = input.startDate ?? today;
  const dueDate = dueDateForNewOrEditedRule({
    rule: input.recurrenceRule,
    fallbackAnchor: startFrom,
    latestCompletionDate: null,
  });
  const { recurrenceType, recurrenceConfig } = serializeRecurrenceRule(input.recurrenceRule);

  return prisma.task.create({
    data: {
      householdId,
      name: input.name,
      description: input.description,
      areaId: input.areaId,
      recurrenceType,
      recurrenceConfig,
      dueDate: calendarDateToUtcDate(dueDate),
      reminderConfig: input.reminderConfig === undefined ? null : input.reminderConfig ? JSON.stringify(input.reminderConfig) : null,
      defaultAssigneeId: input.defaultAssigneeId ?? null,
      estimatedDurationMinutes: input.estimatedDurationMinutes ?? null,
      priority: input.priority ?? "MEDIUM",
      icon: input.icon ?? "🧽",
      allowJoint: input.allowJoint ?? false,
    },
    include: { area: true, defaultAssignee: true },
  });
}

export async function updateTask(householdId: number, id: string, input: UpdateTaskInput) {
  const task = await findTaskOrThrow(householdId, id);
  if (input.areaId !== undefined) await assertAreaInHousehold(householdId, input.areaId);
  if (input.defaultAssigneeId) await assertMemberInHousehold(householdId, input.defaultAssigneeId);

  let dueDateUpdate: Date | undefined;
  let recurrenceUpdate: ReturnType<typeof serializeRecurrenceRule> | undefined;

  if (input.recurrenceRule) {
    const settings = await getHouseholdSettings(householdId);
    const today = householdToday(settings);
    const latest = await prisma.completionEvent.findFirst({
      where: { taskId: id },
      orderBy: { completedAt: "desc" },
    });
    const latestCompletionDate = latest ? instantToCalendarDate(latest.completedAt, settings.timezone) : null;
    const nextDue = dueDateForNewOrEditedRule({
      rule: input.recurrenceRule,
      fallbackAnchor: latestCompletionDate ? today : instantToCalendarDate(task.createdAt, settings.timezone),
      latestCompletionDate,
    });
    dueDateUpdate = calendarDateToUtcDate(nextDue);
    recurrenceUpdate = serializeRecurrenceRule(input.recurrenceRule);
  }

  const data: Prisma.TaskUncheckedUpdateInput = {
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.areaId !== undefined ? { areaId: input.areaId } : {}),
    ...(recurrenceUpdate ?? {}),
    ...(dueDateUpdate !== undefined ? { dueDate: dueDateUpdate } : {}),
    ...(input.reminderConfig !== undefined
      ? { reminderConfig: input.reminderConfig ? JSON.stringify(input.reminderConfig) : null }
      : {}),
    ...(input.defaultAssigneeId !== undefined ? { defaultAssigneeId: input.defaultAssigneeId } : {}),
    ...(input.estimatedDurationMinutes !== undefined ? { estimatedDurationMinutes: input.estimatedDurationMinutes } : {}),
    ...(input.priority !== undefined ? { priority: input.priority } : {}),
    ...(input.icon !== undefined ? { icon: input.icon } : {}),
    ...(input.allowJoint !== undefined ? { allowJoint: input.allowJoint } : {}),
    ...(input.active !== undefined ? { active: input.active, archivedAt: input.active ? null : new Date() } : {}),
  };

  return prisma.task.update({ where: { id }, data, include: { area: true, defaultAssignee: true } });
}

export async function archiveTask(householdId: number, id: string) {
  await findTaskOrThrow(householdId, id);
  return prisma.task.update({ where: { id }, data: { active: false, archivedAt: new Date() } });
}

export async function unarchiveTask(householdId: number, id: string) {
  await findTaskOrThrow(householdId, id);
  return prisma.task.update({ where: { id }, data: { active: true, archivedAt: null } });
}

/**
 * Advances a task's due date exactly as if it had just been completed --
 * without recording a CompletionEvent, so nobody's credited and history
 * stays honest. "Reset the timer" for a chore nobody actually did.
 */
export async function skipTask(householdId: number, id: string) {
  const task = await findTaskOrThrow(householdId, id);
  const settings = await getHouseholdSettings(householdId);
  const rule = parseRecurrenceRule(task.recurrenceConfig);
  const today = householdToday(settings);
  const previousDueDate = utcDateToCalendarDate(task.dueDate);
  const nextDue = computeNextDueDate(rule, { completedOn: today, previousDueDate });

  return prisma.task.update({
    where: { id },
    data: { dueDate: calendarDateToUtcDate(nextDue) },
    include: { area: true, defaultAssignee: true },
  });
}

/**
 * Pushes a task's due date `days` forward from today (not from its current
 * due date -- snoozing an overdue task means "remind me again in N days",
 * not "N days after it was already due"). A temporary postponement, unlike
 * `skipTask`: it ignores the recurrence rule entirely.
 */
export async function snoozeTask(householdId: number, id: string, days: number) {
  await findTaskOrThrow(householdId, id);
  const settings = await getHouseholdSettings(householdId);
  const newDueDate = addDays(householdToday(settings), days);

  return prisma.task.update({
    where: { id },
    data: { dueDate: calendarDateToUtcDate(newDueDate) },
    include: { area: true, defaultAssignee: true },
  });
}

export function taskRecurrenceRule(task: { recurrenceConfig: string }) {
  return parseRecurrenceRule(task.recurrenceConfig);
}

export function taskDueDateAsCalendarDate(task: { dueDate: Date }): CalendarDate {
  return utcDateToCalendarDate(task.dueDate);
}
