"use client";

import Link from "next/link";
import { TaskRow } from "./task-row";
import { MemberPickerSheet } from "./member-picker-sheet";
import { PlusIcon } from "./icons";
import { useCompleteTask } from "@/hooks/use-complete-task";
import { useMembers, useTasks } from "@/hooks/use-household-data";
import { getTaskStatus, type TaskStatus } from "@/lib/task-status";

const STATUS_ORDER: Record<TaskStatus, number> = { overdue: 0, today: 1, upcoming: 2, scheduled: 3 };

export function AreaTaskList({
  areaId,
  todayIso,
  upcomingWindowDays,
}: {
  areaId: string;
  todayIso: string;
  upcomingWindowDays: number;
}) {
  const { tasks, isLoading } = useTasks({ areaId });
  const { members } = useMembers();
  const { requestComplete, completeWithMember, pendingTask, cancelPending, busyTaskId } = useCompleteTask();

  const sorted = [...tasks].sort((a, b) => {
    const infoA = getTaskStatus(a.dueDate, todayIso, upcomingWindowDays);
    const infoB = getTaskStatus(b.dueDate, todayIso, upcomingWindowDays);
    if (STATUS_ORDER[infoA.status] !== STATUS_ORDER[infoB.status]) return STATUS_ORDER[infoA.status] - STATUS_ORDER[infoB.status];
    return infoA.daysFromToday - infoB.daysFromToday;
  });

  return (
    <div className="space-y-3">
      {!isLoading && sorted.length === 0 ? (
        <p className="rounded-[var(--radius-card)] border border-dashed border-border p-6 text-center text-sm text-text-muted">
          No tasks in this area yet.
        </p>
      ) : (
        sorted.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            todayIso={todayIso}
            upcomingWindowDays={upcomingWindowDays}
            showArea={false}
            busy={busyTaskId === task.id}
            onComplete={() => requestComplete(task.id, task.name, task.allowJoint)}
          />
        ))
      )}

      <Link
        href={`/tasks/new?areaId=${areaId}`}
        className="flex items-center justify-center gap-2 rounded-[var(--radius-card)] border-2 border-dashed border-border py-4 text-sm font-bold text-text-muted"
      >
        <PlusIcon width={18} height={18} />
        Add task to this area
      </Link>

      {pendingTask ? (
        <MemberPickerSheet
          title={`Who did "${pendingTask.name}"?`}
          members={members}
          allowJoint={pendingTask.allowJoint}
          onSelect={(memberId) => completeWithMember(pendingTask.id, memberId, pendingTask.name)}
          onClose={cancelPending}
        />
      ) : null}
    </div>
  );
}
