import { AlertIcon, CheckIcon, ClockIcon } from "./icons";
import type { TaskStatus } from "@/lib/task-status";

const CONFIG: Record<TaskStatus, { label: string; bg: string; fg: string; Icon: typeof AlertIcon | null }> = {
  overdue: { label: "Overdue", bg: "var(--color-overdue-soft)", fg: "var(--color-overdue)", Icon: AlertIcon },
  today: { label: "Due today", bg: "var(--color-today-soft)", fg: "var(--color-today)", Icon: ClockIcon },
  upcoming: { label: "Coming up", bg: "var(--color-upcoming-soft)", fg: "var(--color-upcoming)", Icon: ClockIcon },
  scheduled: { label: "Scheduled", bg: "var(--color-surface-alt)", fg: "var(--color-text-muted)", Icon: null },
};

export function StatusBadge({ status, text }: { status: TaskStatus; text: string }) {
  const { bg, fg, Icon } = CONFIG[status];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{ backgroundColor: bg, color: fg }}
    >
      {Icon ? <Icon width={14} height={14} strokeWidth={2.5} /> : null}
      {text}
    </span>
  );
}

export function DoneBadge({ text }: { text: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{ backgroundColor: "var(--color-done-soft)", color: "var(--color-done)" }}
    >
      <CheckIcon width={14} height={14} strokeWidth={2.5} />
      {text}
    </span>
  );
}
