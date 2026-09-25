import type { TaskStatusInfo } from "./task-status";

const RTF = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

/** "2 hours ago", "yesterday", "just now" — for completion timestamps. */
export function formatRelativeTime(date: Date | string, now: Date = new Date()): string {
  const then = typeof date === "string" ? new Date(date) : date;
  const diffMs = then.getTime() - now.getTime();
  const diffSec = Math.round(diffMs / 1000);

  if (Math.abs(diffSec) < 45) return "just now";

  const diffMin = Math.round(diffSec / 60);
  if (Math.abs(diffMin) < 60) return RTF.format(diffMin, "minute");

  const diffHour = Math.round(diffMin / 60);
  if (Math.abs(diffHour) < 24) return RTF.format(diffHour, "hour");

  const diffDay = Math.round(diffHour / 24);
  if (Math.abs(diffDay) < 30) return RTF.format(diffDay, "day");

  const diffMonth = Math.round(diffDay / 30);
  if (Math.abs(diffMonth) < 12) return RTF.format(diffMonth, "month");

  const diffYear = Math.round(diffDay / 365);
  return RTF.format(diffYear, "year");
}

/** Short, friendly label for a due-date status, e.g. "3 days overdue", "Due today", "In 2 days". */
export function formatDueLabel(info: TaskStatusInfo): string {
  if (info.status === "overdue") {
    const days = Math.abs(info.daysFromToday);
    return days === 1 ? "1 day overdue" : `${days} days overdue`;
  }
  if (info.status === "today") return "Due today";
  if (info.daysFromToday === 1) return "Due tomorrow";
  return `Due in ${info.daysFromToday} days`;
}

export function formatDate(dateIso: string | Date, dateFormat: string): string {
  const date = typeof dateIso === "string" ? new Date(`${dateIso}T00:00:00Z`) : dateIso;
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const year = date.getUTCFullYear();
  const monthName = date.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" });

  switch (dateFormat) {
    case "MM/DD/YYYY":
      return `${month}/${day}/${year}`;
    case "YYYY-MM-DD":
      return `${year}-${month}-${day}`;
    case "DD MMM YYYY":
      return `${date.getUTCDate()} ${monthName} ${year}`;
    default:
      return `${day}/${month}/${year}`;
  }
}
