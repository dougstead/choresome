"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import useSWR, { mutate as globalMutate } from "swr";
import { DisplayClock } from "./display-clock";
import { Screensaver } from "./screensaver";
import { CheckIcon } from "@/components/icons";
import { useMembers, useTasks } from "@/hooks/use-household-data";
import { getTaskStatus, type TaskStatus } from "@/lib/task-status";
import { formatDueLabel, formatRelativeTime } from "@/lib/format";
import { fetcher, postJson } from "@/lib/client/fetcher";
import { JOINT_CHOICE } from "@/components/member-picker-sheet";
import type { CompletionEventWithTaskDto, TaskDto } from "@/lib/api/types";
import type { DisplayConfig } from "@/lib/validation/settings";

const STATUS_ORDER: Record<TaskStatus, number> = { overdue: 0, today: 1, upcoming: 2, scheduled: 3 };

function revalidateEverything() {
  return globalMutate((key) => typeof key === "string" && key.startsWith("/api/"), undefined, { revalidate: true });
}

type Mode = { kind: "dashboard" } | { kind: "picking"; task: TaskDto } | { kind: "confirmed"; taskName: string; memberName: string };

export function DisplayApp({
  todayIso,
  upcomingWindowDays,
  householdName,
  timeFormat,
  displayConfig,
}: {
  todayIso: string;
  upcomingWindowDays: number;
  householdName: string;
  timeFormat: string;
  displayConfig: DisplayConfig;
}) {
  const { tasks } = useTasks({ refreshInterval: 30_000 });
  const { members } = useMembers();
  const { data: historyData } = useSWR<{ events: CompletionEventWithTaskDto[] }>(
    "/api/completions?limit=6",
    fetcher,
    { refreshInterval: 30_000 }
  );

  const [mode, setMode] = useState<Mode>({ kind: "dashboard" });
  const [idle, setIdle] = useState(false);
  const lastInteraction = useRef<number | null>(null);

  const wake = useCallback(() => {
    lastInteraction.current = Date.now();
    setIdle(false);
  }, []);

  useEffect(() => {
    lastInteraction.current = Date.now();
    const id = setInterval(() => {
      const last = lastInteraction.current;
      if (last !== null && Date.now() - last > displayConfig.idleTimeoutSeconds * 1000) {
        setIdle(true);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [displayConfig.idleTimeoutSeconds]);

  const withStatus = tasks.map((task) => ({ task, info: getTaskStatus(task.dueDate, todayIso, upcomingWindowDays) }));
  const relevant = withStatus
    .filter((t) => t.info.status !== "scheduled")
    .sort((a, b) => STATUS_ORDER[a.info.status] - STATUS_ORDER[b.info.status] || a.info.daysFromToday - b.info.daysFromToday);
  const tasksRemainingToday = withStatus.filter((t) => t.info.status === "overdue" || t.info.status === "today").length;

  async function handlePick(task: TaskDto, memberId: string, memberName: string) {
    setMode({ kind: "confirmed", taskName: task.name, memberName });
    await postJson(`/api/tasks/${task.id}/complete`, memberId === JOINT_CHOICE ? { joint: true } : { memberId });
    await revalidateEverything();
    setTimeout(() => setMode({ kind: "dashboard" }), 1600);
  }

  if (idle) {
    return (
      <Screensaver
        tasksRemainingToday={tasksRemainingToday}
        brightness={displayConfig.screensaverBrightness}
        timeFormat={timeFormat}
        onWake={wake}
      />
    );
  }

  return (
    <div onPointerDown={wake} className="flex min-h-screen flex-col bg-bg px-4 py-6 text-text sm:px-8">
      <header className="mb-6 flex items-end justify-between">
        <div>
          <p className="text-lg font-semibold text-text-muted">{householdName}</p>
          <h1 className="text-4xl font-extrabold" suppressHydrationWarning>
            {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-2xl font-bold text-text-muted">
            <DisplayClock timeFormat={timeFormat} />
          </span>
          <button
            onClick={() => {
              if (document.fullscreenElement) void document.exitFullscreen();
              else void document.documentElement.requestFullscreen().catch(() => {});
            }}
            className="rounded-full border border-border px-3 py-1.5 text-xs font-bold text-text-muted"
            aria-label="Toggle fullscreen"
          >
            ⛶
          </button>
        </div>
      </header>

      <div className="grid flex-1 grid-cols-1 gap-8 md:grid-cols-2 md:overflow-hidden">
        <section className="flex flex-col md:overflow-y-auto md:pr-2">
          <h2 className="mb-3 text-xl font-extrabold uppercase tracking-wide text-text-muted">To do</h2>
          {relevant.length === 0 ? (
            <p className="rounded-3xl border-2 border-dashed border-border p-8 text-center text-xl text-text-muted">
              All caught up! 🎉
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3 min-[1400px]:grid-cols-2">
              {relevant.map(({ task, info }) => (
                <button
                  key={task.id}
                  onClick={() => setMode({ kind: "picking", task })}
                  className="flex items-start gap-3 rounded-3xl border-2 p-4 text-left shadow-sm transition active:scale-[0.98]"
                  style={{
                    borderColor: info.status === "overdue" ? "var(--color-overdue)" : "var(--color-border)",
                    backgroundColor: "var(--color-surface)",
                  }}
                >
                  <span className="shrink-0 text-4xl leading-none">{task.icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block break-words text-xl font-extrabold leading-tight">{task.name}</span>
                    <span
                      className="mt-1 block text-base font-bold"
                      style={{ color: info.status === "overdue" ? "var(--color-overdue)" : "var(--color-text-muted)" }}
                    >
                      {formatDueLabel(info)}
                    </span>
                    <span className="mt-0.5 block text-sm text-text-muted">
                      {task.area.icon} {task.area.name}
                      {task.recurrenceSummary ? ` · ${task.recurrenceSummary}` : ""}
                      {task.estimatedDurationMinutes ? ` · ~${task.estimatedDurationMinutes} min` : ""}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="flex flex-col md:overflow-y-auto md:pl-2">
          <h2 className="mb-3 text-xl font-extrabold uppercase tracking-wide text-text-muted">Recently completed</h2>
          <div className="space-y-2">
            {(historyData?.events ?? []).length === 0 ? (
              <p className="text-lg text-text-muted">Nothing completed yet.</p>
            ) : (
              historyData?.events.map((event) => (
                <div key={event.id} className="flex items-center gap-3 rounded-2xl bg-surface-alt p-3.5">
                  <span className="text-2xl">{event.task.icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-lg font-bold leading-tight">{event.task.name}</span>
                    <span className="block text-sm text-text-muted">
                      {event.member.name} · {formatRelativeTime(event.completedAt)}
                    </span>
                  </span>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {mode.kind === "picking" ? (
        <div className="fixed inset-0 z-40 flex flex-col items-center justify-center gap-8 bg-black/70 p-8">
          <h2 className="text-3xl font-extrabold text-white">Who did &ldquo;{mode.task.name}&rdquo;?</h2>
          <div className="grid w-full max-w-2xl grid-cols-2 gap-6">
            {members.map((member) => (
              <button
                key={member.id}
                onClick={() => handlePick(mode.task, member.id, member.name)}
                className="flex flex-col items-center gap-3 rounded-3xl bg-white py-10 text-3xl font-extrabold shadow-2xl transition active:scale-95"
                style={{ color: "#2b2621" }}
              >
                <span className="text-7xl">{member.icon}</span>
                {member.name.toUpperCase()}
              </button>
            ))}
            {mode.task.allowJoint ? (
              <button
                onClick={() => handlePick(mode.task, JOINT_CHOICE, "Joint effort")}
                className="col-span-2 flex items-center justify-center gap-4 rounded-3xl bg-white py-8 text-3xl font-extrabold shadow-2xl transition active:scale-95"
                style={{ color: "#2b2621" }}
              >
                <span className="text-6xl">🤝</span>
                JOINT EFFORT
              </button>
            ) : null}
          </div>
          <button onClick={() => setMode({ kind: "dashboard" })} className="text-lg font-bold text-white/70">
            Cancel
          </button>
        </div>
      ) : null}

      {mode.kind === "confirmed" ? (
        <div className="fixed inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-black/80">
          <div
            className="flex h-28 w-28 items-center justify-center rounded-full"
            style={{ backgroundColor: "var(--color-primary)" }}
          >
            <CheckIcon width={56} height={56} strokeWidth={3} className="text-white" />
          </div>
          <p className="text-3xl font-extrabold text-white">Completed!</p>
          <p className="text-lg text-white/70">
            {mode.taskName} — {mode.memberName}
          </p>
        </div>
      ) : null}
    </div>
  );
}
