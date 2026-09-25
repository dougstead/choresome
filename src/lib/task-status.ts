export type TaskStatus = "overdue" | "today" | "upcoming" | "scheduled";

export interface TaskStatusInfo {
  status: TaskStatus;
  /** Negative if overdue, 0 if due today, positive if in the future. */
  daysFromToday: number;
}

/** `dueDateIso` and `todayIso` are "YYYY-MM-DD" calendar dates (no time component). */
export function getTaskStatus(dueDateIso: string, todayIso: string, upcomingWindowDays: number): TaskStatusInfo {
  const due = Date.parse(`${dueDateIso}T00:00:00Z`);
  const today = Date.parse(`${todayIso}T00:00:00Z`);
  const daysFromToday = Math.round((due - today) / 86_400_000);

  if (daysFromToday < 0) return { status: "overdue", daysFromToday };
  if (daysFromToday === 0) return { status: "today", daysFromToday };
  if (daysFromToday <= upcomingWindowDays) return { status: "upcoming", daysFromToday };
  return { status: "scheduled", daysFromToday };
}
