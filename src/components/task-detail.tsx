"use client";

import Link from "next/link";
import useSWR from "swr";
import { ArrowLeftIcon, CheckIcon, EditIcon } from "./icons";
import { StatusBadge } from "./status-badge";
import { MemberPickerSheet } from "./member-picker-sheet";
import { TaskStatsPanel } from "./task-stats-panel";
import { TaskQrCode } from "./task-qr-code";
import { CompletionHistoryList } from "./completion-history-list";
import { useCompleteTask } from "@/hooks/use-complete-task";
import { useMembers } from "@/hooks/use-household-data";
import { getTaskStatus } from "@/lib/task-status";
import { formatDate, formatDueLabel } from "@/lib/format";
import { fetcher, patchJson } from "@/lib/client/fetcher";
import { mutate as globalMutate } from "swr";
import type { TaskDto } from "@/lib/api/types";
import type { TaskStats } from "@/lib/services/stats-service";

export function TaskDetail({
  task: initialTask,
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
  const { data: stats } = useSWR<TaskStats>(`/api/stats/tasks/${initialTask.id}`, fetcher);
  // Seeded with the server-rendered task so the page is instant, but kept live via
  // SWR: completing/archiving revalidates `/api/tasks/*` and this picks it up without
  // a full page reload (the server `task` prop is a one-time snapshot otherwise).
  const { data: taskData } = useSWR<{ task: TaskDto }>(`/api/tasks/${initialTask.id}`, fetcher, {
    fallbackData: { task: initialTask },
  });
  const task = taskData?.task ?? initialTask;

  const info = getTaskStatus(task.dueDate, todayIso, upcomingWindowDays);
  const busy = busyTaskId === task.id;

  async function toggleArchive() {
    await patchJson(`/api/tasks/${task.id}`, { active: !task.active });
    await globalMutate((key) => typeof key === "string" && key.startsWith("/api/"), undefined, { revalidate: true });
  }

  return (
    <div className="space-y-6 pb-10">
      <div className="flex items-center justify-between">
        <Link href="/" className="inline-flex items-center gap-1 text-sm font-bold text-text-muted">
          <ArrowLeftIcon width={18} height={18} />
          Back
        </Link>
        <Link href={`/tasks/${task.id}/edit`} className="inline-flex items-center gap-1 text-sm font-bold" style={{ color: "var(--color-primary)" }}>
          <EditIcon width={16} height={16} />
          Edit
        </Link>
      </div>

      <div>
        <div className="flex items-start gap-3">
          <span className="text-4xl">{task.icon}</span>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-extrabold">{task.name}</h1>
            <p className="text-sm text-text-muted">
              {task.area.icon} {task.area.name}
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {task.active ? <StatusBadge status={info.status} text={formatDueLabel(info)} /> : null}
          {!task.active ? (
            <span className="rounded-full bg-surface-alt px-2.5 py-1 text-xs font-semibold text-text-muted">Archived</span>
          ) : null}
          <span className="text-xs text-text-muted">{task.recurrenceSummary}</span>
        </div>
        {task.description ? <p className="mt-3 text-sm text-text">{task.description}</p> : null}
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-[var(--radius-card)] border border-border bg-surface p-3.5">
          <p className="text-xs font-bold uppercase tracking-wide text-text-muted">Last completed</p>
          <p className="mt-1 font-bold">
            {stats?.lastCompletedAt
              ? `${formatDate(new Date(stats.lastCompletedAt), dateFormat)} — ${stats.lastCompletedByMemberName}`
              : "Never completed"}
          </p>
        </div>
        <div className="rounded-[var(--radius-card)] border border-border bg-surface p-3.5">
          <p className="text-xs font-bold uppercase tracking-wide text-text-muted">Next due</p>
          <p className="mt-1 font-bold">{task.active ? formatDate(task.dueDate, dateFormat) : "—"}</p>
        </div>
      </div>

      {task.active ? (
        <button
          onClick={() => requestComplete(task.id, task.name)}
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-full py-4 text-base font-extrabold disabled:opacity-60"
          style={{ backgroundColor: "var(--color-primary)", color: "var(--color-primary-foreground)" }}
        >
          <CheckIcon width={22} height={22} strokeWidth={3} />
          {busy ? "Completing…" : "Mark complete"}
        </button>
      ) : (
        <button
          onClick={toggleArchive}
          className="w-full rounded-full border-2 border-border py-3 text-sm font-bold text-text-muted"
        >
          Restore from archive
        </button>
      )}

      {task.active ? (
        <button onClick={toggleArchive} className="w-full text-center text-sm font-semibold text-text-muted underline underline-offset-2">
          Archive this task
        </button>
      ) : null}

      <TaskQrCode shortId={task.shortId} taskName={task.name} />

      <section>
        <h2 className="mb-2 text-sm font-extrabold uppercase tracking-wide text-text-muted">Statistics</h2>
        <TaskStatsPanel taskId={task.id} />
      </section>

      <section>
        <h2 className="mb-2 text-sm font-extrabold uppercase tracking-wide text-text-muted">History</h2>
        <CompletionHistoryList taskId={task.id} />
      </section>

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
