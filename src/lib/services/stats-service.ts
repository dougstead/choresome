import { prisma } from "@/lib/db";
import { calendarDateToUtcDate, instantToCalendarDate, startOfMonth, startOfWeek } from "@/lib/dates";
import { getHouseholdSettings } from "./settings-service";

const DAY_MS = 86_400_000;

export interface TaskStats {
  totalCompletions: number;
  completionsLast30Days: number;
  completionsLast12Months: number;
  averageIntervalDays: number | null;
  longestIntervalDays: number | null;
  completionsByMember: { memberId: string; memberName: string; count: number }[];
  currentIntervalDays: number | null;
  lastCompletedAt: Date | null;
  lastCompletedByMemberName: string | null;
}

export async function getTaskStats(taskId: string): Promise<TaskStats> {
  const events = await prisma.completionEvent.findMany({
    where: { taskId },
    include: { member: true },
    orderBy: { completedAt: "asc" },
  });

  if (events.length === 0) {
    return {
      totalCompletions: 0,
      completionsLast30Days: 0,
      completionsLast12Months: 0,
      averageIntervalDays: null,
      longestIntervalDays: null,
      completionsByMember: [],
      currentIntervalDays: null,
      lastCompletedAt: null,
      lastCompletedByMemberName: null,
    };
  }

  const now = Date.now();
  const last30 = events.filter((e) => now - e.completedAt.getTime() <= 30 * DAY_MS).length;
  const last12mo = events.filter((e) => now - e.completedAt.getTime() <= 365 * DAY_MS).length;

  const gaps: number[] = [];
  for (let i = 1; i < events.length; i++) {
    const prevEvent = events[i - 1];
    const currEvent = events[i];
    if (!prevEvent || !currEvent) continue;
    gaps.push((currEvent.completedAt.getTime() - prevEvent.completedAt.getTime()) / DAY_MS);
  }
  const averageIntervalDays = gaps.length > 0 ? gaps.reduce((a, b) => a + b, 0) / gaps.length : null;
  const longestIntervalDays = gaps.length > 0 ? Math.max(...gaps) : null;

  const byMember = new Map<string, { memberName: string; count: number }>();
  for (const event of events) {
    const existing = byMember.get(event.memberId);
    if (existing) existing.count += 1;
    else byMember.set(event.memberId, { memberName: event.member.name, count: 1 });
  }

  const lastEvent = events[events.length - 1];
  const currentIntervalDays = lastEvent ? (now - lastEvent.completedAt.getTime()) / DAY_MS : null;

  return {
    totalCompletions: events.length,
    completionsLast30Days: last30,
    completionsLast12Months: last12mo,
    averageIntervalDays,
    longestIntervalDays,
    completionsByMember: Array.from(byMember.entries()).map(([memberId, v]) => ({ memberId, ...v })),
    currentIntervalDays,
    lastCompletedAt: lastEvent?.completedAt ?? null,
    lastCompletedByMemberName: lastEvent?.member.name ?? null,
  };
}

export interface HouseholdStats {
  completedThisWeek: number;
  completedThisMonth: number;
  completionsByPerson: { memberId: string; memberName: string; count: number }[];
  completionsByArea: { areaId: string; areaName: string; count: number }[];
  recentActivity: Awaited<ReturnType<typeof recentActivityQuery>>;
}

function recentActivityQuery(limit: number) {
  return prisma.completionEvent.findMany({
    include: { member: true, task: { include: { area: true } } },
    orderBy: { completedAt: "desc" },
    take: limit,
  });
}

export async function getHouseholdStats(options: { recentActivityLimit?: number } = {}): Promise<HouseholdStats> {
  const settings = await getHouseholdSettings();
  const today = instantToCalendarDate(new Date(), settings.timezone);
  const weekStart = calendarDateToUtcDate(startOfWeek(today));
  const monthStart = calendarDateToUtcDate(startOfMonth(today));

  const [thisWeekEvents, thisMonthEvents, recentActivity] = await Promise.all([
    prisma.completionEvent.findMany({ where: { completedAt: { gte: weekStart } }, include: { member: true, task: { include: { area: true } } } }),
    prisma.completionEvent.findMany({ where: { completedAt: { gte: monthStart } }, include: { member: true, task: { include: { area: true } } } }),
    recentActivityQuery(options.recentActivityLimit ?? 20),
  ]);

  const byPerson = new Map<string, { memberName: string; count: number }>();
  const byArea = new Map<string, { areaName: string; count: number }>();
  for (const event of thisMonthEvents) {
    const person = byPerson.get(event.memberId);
    if (person) person.count += 1;
    else byPerson.set(event.memberId, { memberName: event.member.name, count: 1 });

    const area = byArea.get(event.task.areaId);
    if (area) area.count += 1;
    else byArea.set(event.task.areaId, { areaName: event.task.area.name, count: 1 });
  }

  return {
    completedThisWeek: thisWeekEvents.length,
    completedThisMonth: thisMonthEvents.length,
    completionsByPerson: Array.from(byPerson.entries()).map(([memberId, v]) => ({ memberId, ...v })),
    completionsByArea: Array.from(byArea.entries()).map(([areaId, v]) => ({ areaId, ...v })),
    recentActivity,
  };
}
