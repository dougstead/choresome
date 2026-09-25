"use client";

import Link from "next/link";
import { CheckIcon } from "./icons";
import { StatusBadge } from "./status-badge";
import { MemberPickerSheet } from "./member-picker-sheet";
import { useCompleteTask } from "@/hooks/use-complete-task";
import { useMembers } from "@/hooks/use-household-data";
import { getTaskStatus } from "@/lib/task-status";
import { formatDate, formatDueLabel } from "@/lib/format";
import type { TaskDto } from "@/lib/api/types";

/** Minimal, big-target "tap to complete" card for the /t/[shortId] NFC/QR landing page. */
export function QuickCompleteCard({
  task,
  todayIso,
  upcomingWindowDays,
  dateFormat,
}: {
  task: TaskDto;
  todayIso: string;
  upcomingWindowDays: number;
  dateFormat: string;
}) {
  const { members } = useMembers();
  const { requestComplete, completeWithMember, pendingTask, cancelPending, busyTaskId } = useCompleteTask();
  const info = getTaskStatus(task.dueDate, todayIso, upcomingWindowDays);
  const busy = busyTaskId === task.id;

  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-6 px-6 py-10 text-center">
      <span className="text-6xl">{task.icon}</span>
      <div>
        <h1 className="text-3xl font-extrabold">{task.name}</h1>
        <p className="mt-1 text-text-muted">
          {task.area.icon} {task.area.name}
        </p>
      </div>
      <StatusBadge status={info.status} text={formatDueLabel(info)} />
      <p className="text-sm text-text-muted">Due {formatDate(task.dueDate, dateFormat)}</p>

      <button
        onClick={() => requestComplete(task.id, task.name)}
        disabled={busy}
        className="mt-4 flex w-full max-w-xs items-center justify-center gap-2 rounded-full py-5 text-lg font-extrabold shadow-lg disabled:opacity-60"
        style={{ backgroundColor: "var(--color-primary)", color: "var(--color-primary-foreground)" }}
      >
        <CheckIcon width={26} height={26} strokeWidth={3} />
        {busy ? "Completing…" : "Mark Complete"}
      </button>

      <Link href={`/tasks/${task.id}`} className="text-sm font-bold text-text-muted underline underline-offset-2">
        View full task
      </Link>

      {pendingTask ? (
        <MemberPickerSheet
          title={`Who did "${pendingTask.name}"?`}
          members={members}
          onSelect={(memberId) => completeWithMember(pendingTask.id, memberId, pendingTask.name)}
          onClose={cancelPending}
        />
      ) : null}
    </div>
  );
}
