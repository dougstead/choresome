"use client";

import Link from "next/link";
import { CheckIcon } from "./icons";
import { StatusBadge } from "./status-badge";
import { getTaskStatus } from "@/lib/task-status";
import { formatDueLabel } from "@/lib/format";
import type { TaskDto } from "@/lib/api/types";

export function TaskRow({
  task,
  todayIso,
  upcomingWindowDays,
  showArea = true,
  busy = false,
  onComplete,
}: {
  task: TaskDto;
  todayIso: string;
  upcomingWindowDays: number;
  showArea?: boolean;
  busy?: boolean;
  onComplete: () => void;
}) {
  const info = getTaskStatus(task.dueDate, todayIso, upcomingWindowDays);

  return (
    <div className="flex items-center gap-3 rounded-[var(--radius-card)] border border-border bg-surface p-3.5 shadow-sm">
      <Link href={`/tasks/${task.id}`} className="flex min-w-0 flex-1 items-center gap-3">
        <span className="shrink-0 text-2xl" aria-hidden>
          {task.icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-bold">{task.name}</span>
          <span className="mt-1 flex flex-wrap items-center gap-2">
            <StatusBadge status={info.status} text={formatDueLabel(info)} />
            {showArea ? (
              <span className="truncate text-xs text-text-muted">
                {task.area.icon} {task.area.name}
              </span>
            ) : null}
          </span>
        </span>
      </Link>
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onComplete();
        }}
        disabled={busy}
        aria-label={`Mark ${task.name} complete`}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 text-primary transition active:scale-90 disabled:opacity-50"
        style={{ borderColor: "var(--color-primary)" }}
      >
        <CheckIcon width={22} height={22} strokeWidth={3} />
      </button>
    </div>
  );
}
