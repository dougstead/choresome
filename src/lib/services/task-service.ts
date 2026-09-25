import { customAlphabet } from "nanoid";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  calendarDateToUtcDate,
  instantToCalendarDate,
  utcDateToCalendarDate,
  type CalendarDate,
} from "@/lib/dates";
import { parseRecurrenceRule, serializeRecurrenceRule } from "@/lib/recurrence/serialize";
import { getHouseholdSettings } from "./settings-service";
import { dueDateForNewOrEditedRule } from "./scheduling";
import type { CreateTaskInput, UpdateTaskInput } from "@/lib/validation/task";

// Unambiguous, URL-safe alphabet (no 0/O/1/I/l) — these get printed on QR codes and typed by hand for NFC.
const nanoid = customAlphabet("23456789ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz", 8);

async function generateUniqueShortId(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = nanoid();
    const existing = await prisma.task.findUnique({ where: { shortId: candidate } });
    if (!existing) return candidate;
  }
  throw new Error("Could not generate a unique task short ID");
}

export async function listTasks(options: { includeArchived?: boolean; areaId?: string } = {}) {
  return prisma.task.findMany({
    where: {
      ...(options.includeArchived ? {} : { active: true }),
      ...(options.areaId ? { areaId: options.areaId } : {}),
    },
    include: { area: true, defaultAssignee: true },
    orderBy: { dueDate: "asc" },
  });
}

export async function getTaskById(id: string) {
  return prisma.task.findUnique({
    where: { id },
    include: { area: true, defaultAssignee: true },
  });
}

export async function getTaskByShortId(shortId: string) {
  return prisma.task.findUnique({
    where: { shortId },
    include: { area: true, defaultAssignee: true },
  });
}

export async function createTask(input: CreateTaskInput) {
  const settings = await getHouseholdSettings();
  const today = instantToCalendarDate(new Date(), settings.timezone);
  const startFrom: CalendarDate = input.startDate ?? today;
  const dueDate = dueDateForNewOrEditedRule({
    rule: input.recurrenceRule,
    fallbackAnchor: startFrom,
    latestCompletionDate: null,
  });
  const { recurrenceType, recurrenceConfig } = serializeRecurrenceRule(input.recurrenceRule);
  const shortId = await generateUniqueShortId();

  return prisma.task.create({
    data: {
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
      shortId,
    },
    include: { area: true, defaultAssignee: true },
  });
}

export async function updateTask(id: string, input: UpdateTaskInput) {
  const task = await prisma.task.findUniqueOrThrow({ where: { id } });

  let dueDateUpdate: Date | undefined;
  let recurrenceUpdate: ReturnType<typeof serializeRecurrenceRule> | undefined;

  if (input.recurrenceRule) {
    const settings = await getHouseholdSettings();
    const today = instantToCalendarDate(new Date(), settings.timezone);
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
    ...(input.active !== undefined ? { active: input.active, archivedAt: input.active ? null : new Date() } : {}),
  };

  return prisma.task.update({ where: { id }, data, include: { area: true, defaultAssignee: true } });
}

export async function archiveTask(id: string) {
  return prisma.task.update({ where: { id }, data: { active: false, archivedAt: new Date() } });
}

export async function unarchiveTask(id: string) {
  return prisma.task.update({ where: { id }, data: { active: true, archivedAt: null } });
}

export function taskRecurrenceRule(task: { recurrenceConfig: string }) {
  return parseRecurrenceRule(task.recurrenceConfig);
}

export function taskDueDateAsCalendarDate(task: { dueDate: Date }): CalendarDate {
  return utcDateToCalendarDate(task.dueDate);
}
