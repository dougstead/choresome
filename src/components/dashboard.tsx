"use client";

import useSWR from "swr";
import Link from "next/link";
import { TaskRow } from "./task-row";
import { MemberPickerSheet } from "./member-picker-sheet";
import { DoneBadge } from "./status-badge";
import { PlusIcon } from "./icons";
import { useCompleteTask } from "@/hooks/use-complete-task";
import { useMembers, useTasks } from "@/hooks/use-household-data";
import { getTaskStatus } from "@/lib/task-status";
import { formatRelativeTime } from "@/lib/format";
import { fetcher } from "@/lib/client/fetcher";
import type { CompletionEventWithTaskDto } from "@/lib/api/types";

function greeting(hour: number): string {
  if (hour < 5) return "Still up?";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function Dashboard({
  todayIso,
  upcomingWindowDays,
  householdName,
}: {
  todayIso: string;
  upcomingWindowDays: number;
  householdName: string;
}) {
  const { tasks, isLoading } = useTasks();
  const { members } = useMembers();
  const { data: historyData } = useSWR<{ events: CompletionEventWithTaskDto[] }>("/api/completions?limit=8", fetcher);
  const { requestComplete, completeWithMember, pendingTask, cancelPending, busyTaskId } = useCompleteTask();

  const withStatus = tasks.map((task) => ({ task, info: getTaskStatus(task.dueDate, todayIso, upcomingWindowDays) }));
  const overdue = withStatus.filter((t) => t.info.status === "overdue").sort((a, b) => a.info.daysFromToday - b.info.daysFromToday);
  const dueToday = withStatus.filter((t) => t.info.status === "today");
  const upcoming = withStatus.filter((t) => t.info.status === "upcoming").sort((a, b) => a.info.daysFromToday - b.info.daysFromToday);

  return (
    <div className="space-y-7">
      <header>
        <p className="text-sm font-semibold text-text-muted">{householdName}</p>
        <h1 className="text-2xl font-extrabold" suppressHydrationWarning>
          {greeting(new Date().getHours())}
        </h1>
      </header>

      {!isLoading && tasks.length === 0 ? (
        <EmptyDashboard />
      ) : (
        <>
          <Section
            title="Overdue"
            emptyText="Nothing overdue — nice!"
            items={overdue}
            render={(task) => (
              <TaskRow
                key={task.id}
                task={task}
                todayIso={todayIso}
                upcomingWindowDays={upcomingWindowDays}
                busy={busyTaskId === task.id}
                onComplete={() => requestComplete(task.id, task.name, task.allowJoint)}
              />
            )}
          />
          <Section
            title="Today"
            emptyText="Nothing due today."
            items={dueToday}
            render={(task) => (
              <TaskRow
                key={task.id}
                task={task}
                todayIso={todayIso}
                upcomingWindowDays={upcomingWindowDays}
                busy={busyTaskId === task.id}
                onComplete={() => requestComplete(task.id, task.name, task.allowJoint)}
              />
            )}
          />
          <Section
            title="Coming Up"
            emptyText={`Nothing due in the next ${upcomingWindowDays} days.`}
            items={upcoming}
            render={(task) => (
              <TaskRow
                key={task.id}
                task={task}
                todayIso={todayIso}
                upcomingWindowDays={upcomingWindowDays}
                busy={busyTaskId === task.id}
                onComplete={() => requestComplete(task.id, task.name, task.allowJoint)}
              />
            )}
          />
        </>
      )}

      <section>
        <h2 className="mb-2 text-sm font-extrabold uppercase tracking-wide text-text-muted">Recently Completed</h2>
        {historyData && historyData.events.length > 0 ? (
          <ul className="space-y-2">
            {historyData.events.map((event) => (
              <li
                key={event.id}
                className="flex items-center gap-3 rounded-[var(--radius-card)] border border-border bg-surface p-3.5"
              >
                <span className="text-xl">{event.task.icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold">{event.task.name}</span>
                  <span className="text-xs text-text-muted">
                    {event.member.name} &middot; {formatRelativeTime(event.completedAt)}
                  </span>
                </span>
                <DoneBadge text="Done" />
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-[var(--radius-card)] border border-dashed border-border p-4 text-center text-sm text-text-muted">
            Nothing completed yet.
          </p>
        )}
      </section>

      <Link
        href="/tasks/new"
        className="fixed bottom-24 right-4 z-20 flex h-14 w-14 items-center justify-center rounded-full shadow-lg"
        style={{ backgroundColor: "var(--color-primary)", color: "var(--color-primary-foreground)" }}
        aria-label="Add a new task"
      >
        <PlusIcon width={26} height={26} strokeWidth={2.5} />
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

function Section<T extends { task: { id: string } }>({
  title,
  items,
  emptyText,
  render,
}: {
  title: string;
  items: T[];
  emptyText: string;
  render: (task: T["task"]) => React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-extrabold uppercase tracking-wide text-text-muted">{title}</h2>
      {items.length > 0 ? (
        <div className="space-y-2">{items.map((item) => render(item.task))}</div>
      ) : (
        <p className="rounded-[var(--radius-card)] border border-dashed border-border p-4 text-center text-sm text-text-muted">
          {emptyText}
        </p>
      )}
    </section>
  );
}

function EmptyDashboard() {
  return (
    <div className="rounded-[var(--radius-card)] border border-dashed border-border p-8 text-center">
      <p className="text-4xl">🧺</p>
      <h2 className="mt-3 text-lg font-extrabold">No tasks yet</h2>
      <p className="mt-1 text-sm text-text-muted">Add your first chore to get started.</p>
      <Link
        href="/tasks/new"
        className="mt-4 inline-block rounded-full px-5 py-2.5 text-sm font-bold"
        style={{ backgroundColor: "var(--color-primary)", color: "var(--color-primary-foreground)" }}
      >
        Add a task
      </Link>
    </div>
  );
}
