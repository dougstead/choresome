"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import useSWR, { mutate as globalMutate } from "swr";
import { DisplayClock } from "./display-clock";
import { Screensaver } from "./screensaver";
import { CheckIcon, ClockIcon } from "@/components/icons";
import { useMembers, useSettings, useTasks } from "@/hooks/use-household-data";
import { getTaskStatus, type TaskStatus } from "@/lib/task-status";
import { formatDate, formatDueLabel, formatRelativeTime } from "@/lib/format";
import { fetcher, postJson } from "@/lib/client/fetcher";
import { JOINT_CHOICE } from "@/components/member-picker-sheet";
import { calendarDateToIsoDate, instantToCalendarDate } from "@/lib/dates";
import type { CompletionEventWithTaskDto, MemberDto, TaskDto } from "@/lib/api/types";
import type { DisplayConfig } from "@/lib/validation/settings";
import type { TaskStats } from "@/lib/services/stats-service";

// Tap targets rather than a number field: the display is a touch-only kiosk.
const SNOOZE_CHOICES = [
  { days: 1, label: "1 day" },
  { days: 2, label: "2 days" },
  { days: 3, label: "3 days" },
  { days: 7, label: "1 week" },
  { days: 14, label: "2 weeks" },
];

const STATUS_ORDER: Record<TaskStatus, number> = { overdue: 0, today: 1, upcoming: 2, scheduled: 3 };

function revalidateEverything() {
  return globalMutate((key) => typeof key === "string" && key.startsWith("/api/"), undefined, { revalidate: true });
}

type Confirmation = { headline: string; detail: string; icon: "check" | "clock" };

type Mode = { kind: "dashboard" } | { kind: "task"; task: TaskDto } | ({ kind: "confirmed" } & Confirmation);

export function DisplayApp({
  todayIso: initialTodayIso,
  timezone,
  upcomingWindowDays,
  householdName,
  timeFormat,
  dateFormat,
  displayConfig,
  holidayMode: initialHolidayMode,
}: {
  todayIso: string;
  timezone: string;
  upcomingWindowDays: number;
  householdName: string;
  timeFormat: string;
  dateFormat: string;
  displayConfig: DisplayConfig;
  holidayMode: boolean;
}) {
  const { tasks } = useTasks({ refreshInterval: 30_000 });
  const { members } = useMembers();
  const { data: historyData } = useSWR<{ events: CompletionEventWithTaskDto[] }>(
    "/api/completions?limit=6",
    fetcher,
    { refreshInterval: 30_000 }
  );
  // Polled (not just the initial SSR prop) so a Holiday-mode toggle made from
  // someone's phone shows up here too, without this kiosk ever being reloaded.
  const { settings: liveSettings } = useSettings({ refreshInterval: 30_000 });
  const holidayMode = liveSettings ? liveSettings.holidayMode : initialHolidayMode;

  const [mode, setMode] = useState<Mode>({ kind: "dashboard" });
  const [idle, setIdle] = useState(false);
  const lastInteraction = useRef<number | null>(null);

  // SWR skips re-rendering consumers when a poll returns data that's deep-equal
  // to what's cached, which is the common case here (nothing new completed).
  // Without this, "3 minutes ago" and "due today" never advance on a kiosk
  // display that's never manually reloaded -- this tick forces a re-render
  // every 30s regardless, and refreshes `todayIso` so day-boundary rollovers
  // (a task going from "due today" to "overdue" at midnight) aren't stuck
  // until someone refreshes the page.
  const [todayIso, setTodayIso] = useState(initialTodayIso);
  const [, forceTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      // While Holiday mode is on, `todayIso` stays pinned to whatever the
      // server sent (the day it started) -- only the relative-time strings
      // ("2 hours ago") keep moving, via forceTick below.
      if (!holidayMode) {
        setTodayIso(calendarDateToIsoDate(instantToCalendarDate(new Date(), timezone)));
      }
      forceTick((t) => t + 1);
    }, 30_000);
    return () => clearInterval(id);
  }, [timezone, holidayMode]);

  const wake = useCallback(() => {
    lastInteraction.current = Date.now();
    setIdle(false);
    // Requesting fullscreen needs a user gesture -- browsers reject a call
    // with no click/tap behind it. A phone lock/unlock (or the screensaver
    // taking over) drops fullscreen, so re-request it on the tap that wakes
    // the display back up rather than requiring a separate manual toggle.
    if (typeof document !== "undefined" && !document.fullscreenElement) {
      void document.documentElement.requestFullscreen().catch(() => {});
    }
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

  useEffect(() => {
    // Best-effort: some Android/Chrome versions carry enough "user activation"
    // from the unlock gesture itself to allow this without a tap on the page.
    // Silently ignored where it's not allowed -- the wake()-on-tap path above
    // is the reliable fallback.
    function onVisible() {
      if (document.visibilityState === "visible" && !document.fullscreenElement) {
        void document.documentElement.requestFullscreen().catch(() => {});
      }
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  const withStatus = tasks.map((task) => ({ task, info: getTaskStatus(task.dueDate, todayIso, upcomingWindowDays) }));
  const relevant = withStatus
    .filter((t) => t.info.status !== "scheduled")
    .sort((a, b) => STATUS_ORDER[a.info.status] - STATUS_ORDER[b.info.status] || a.info.daysFromToday - b.info.daysFromToday);
  const tasksRemainingToday = withStatus.filter((t) => t.info.status === "overdue" || t.info.status === "today").length;

  const [busy, setBusy] = useState(false);

  function showConfirmation(confirmation: Confirmation) {
    setMode({ kind: "confirmed", ...confirmation });
    setTimeout(() => setMode({ kind: "dashboard" }), 1600);
  }

  async function handlePick(task: TaskDto, memberId: string, memberName: string) {
    showConfirmation({ headline: "Completed!", detail: `${task.name} — ${memberName}`, icon: "check" });
    await postJson(`/api/tasks/${task.id}/complete`, memberId === JOINT_CHOICE ? { joint: true } : { memberId });
    await revalidateEverything();
  }

  async function handleSkip(task: TaskDto) {
    setBusy(true);
    try {
      const { task: updated } = await postJson<{ task: TaskDto }>(`/api/tasks/${task.id}/skip`, {});
      await revalidateEverything();
      showConfirmation({ headline: "Skipped", detail: `${task.name} — next due ${formatDate(updated.dueDate, dateFormat)}`, icon: "clock" });
    } finally {
      setBusy(false);
    }
  }

  async function handleSnooze(task: TaskDto, days: number) {
    setBusy(true);
    try {
      const { task: updated } = await postJson<{ task: TaskDto }>(`/api/tasks/${task.id}/snooze`, { days });
      await revalidateEverything();
      showConfirmation({ headline: "Snoozed", detail: `${task.name} — now due ${formatDate(updated.dueDate, dateFormat)}`, icon: "clock" });
    } finally {
      setBusy(false);
    }
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
          {holidayMode ? (
            <span
              className="rounded-full px-3 py-1.5 text-sm font-bold"
              style={{ backgroundColor: "var(--color-primary-soft)", color: "var(--color-primary)" }}
            >
              🏖️ Holiday mode
            </span>
          ) : null}
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
                  onClick={() => setMode({ kind: "task", task })}
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

      {mode.kind === "task" ? (
        <DisplayTaskSheet
          task={mode.task}
          todayIso={todayIso}
          upcomingWindowDays={upcomingWindowDays}
          dateFormat={dateFormat}
          members={members}
          busy={busy}
          onPick={(memberId, memberName) => handlePick(mode.task, memberId, memberName)}
          onSkip={() => handleSkip(mode.task)}
          onSnooze={(days) => handleSnooze(mode.task, days)}
          onClose={() => setMode({ kind: "dashboard" })}
        />
      ) : null}

      {mode.kind === "confirmed" ? (
        <div className="fixed inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-black/80">
          <div
            className="flex h-28 w-28 items-center justify-center rounded-full"
            style={{ backgroundColor: "var(--color-primary)" }}
          >
            {mode.icon === "check" ? (
              <CheckIcon width={56} height={56} strokeWidth={3} className="text-white" />
            ) : (
              <ClockIcon width={56} height={56} strokeWidth={2.5} className="text-white" />
            )}
          </div>
          <p className="text-3xl font-extrabold text-white">{mode.headline}</p>
          <p className="text-lg text-white/70">{mode.detail}</p>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Opened by tapping a task on the display. Completing stays a single tap (the
 * member buttons are right here), with the task's details plus Skip/Snooze
 * alongside for when it isn't getting done today.
 */
function DisplayTaskSheet({
  task,
  todayIso,
  upcomingWindowDays,
  dateFormat,
  members,
  busy,
  onPick,
  onSkip,
  onSnooze,
  onClose,
}: {
  task: TaskDto;
  todayIso: string;
  upcomingWindowDays: number;
  dateFormat: string;
  members: MemberDto[];
  busy: boolean;
  onPick: (memberId: string, memberName: string) => void;
  onSkip: () => void;
  onSnooze: (days: number) => void;
  onClose: () => void;
}) {
  const { data: stats } = useSWR<TaskStats>(`/api/stats/tasks/${task.id}`, fetcher);
  const info = getTaskStatus(task.dueDate, todayIso, upcomingWindowDays);
  const overdue = info.status === "overdue";

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-black/70 p-4 sm:p-8" onClick={onClose}>
      <div
        className="mx-auto flex max-w-3xl flex-col gap-6 rounded-3xl bg-surface p-6 text-text shadow-2xl sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-4">
          <span className="shrink-0 text-6xl leading-none">{task.icon}</span>
          <div className="min-w-0 flex-1">
            <h2 className="break-words text-3xl font-extrabold leading-tight">{task.name}</h2>
            <p className="mt-1 text-lg font-bold" style={{ color: overdue ? "var(--color-overdue)" : "var(--color-text-muted)" }}>
              {formatDueLabel(info)} · {formatDate(task.dueDate, dateFormat)}
            </p>
            <p className="mt-0.5 text-base text-text-muted">
              {task.area.icon} {task.area.name}
              {task.recurrenceSummary ? ` · ${task.recurrenceSummary}` : ""}
              {task.estimatedDurationMinutes ? ` · ~${task.estimatedDurationMinutes} min` : ""}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-full bg-surface-alt px-4 py-2 text-lg font-bold text-text-muted"
          >
            ✕
          </button>
        </div>

        {task.description ? <p className="text-lg">{task.description}</p> : null}

        <p className="text-base text-text-muted">
          Last done:{" "}
          <span className="font-bold text-text">
            {stats === undefined
              ? "…"
              : stats.lastCompletedAt
                ? `${formatRelativeTime(stats.lastCompletedAt)} by ${stats.lastCompletedByMemberName}`
                : "never"}
          </span>
        </p>

        <section>
          <h3 className="mb-3 text-lg font-extrabold uppercase tracking-wide text-text-muted">Who did it?</h3>
          <div className="grid grid-cols-2 gap-4">
            {members.map((member) => (
              <button
                key={member.id}
                onClick={() => onPick(member.id, member.name)}
                disabled={busy}
                className="flex flex-col items-center gap-2 rounded-3xl py-6 text-2xl font-extrabold shadow-md transition active:scale-95 disabled:opacity-60"
                style={{ backgroundColor: "var(--color-primary)", color: "var(--color-primary-foreground)" }}
              >
                <span className="text-5xl">{member.icon}</span>
                {member.name.toUpperCase()}
              </button>
            ))}
            {task.allowJoint ? (
              <button
                onClick={() => onPick(JOINT_CHOICE, "Joint effort")}
                disabled={busy}
                className="col-span-2 flex items-center justify-center gap-4 rounded-3xl py-5 text-2xl font-extrabold shadow-md transition active:scale-95 disabled:opacity-60"
                style={{ backgroundColor: "var(--color-primary)", color: "var(--color-primary-foreground)" }}
              >
                <span className="text-4xl">🤝</span>
                JOINT EFFORT
              </button>
            ) : null}
          </div>
        </section>

        <section>
          <h3 className="mb-3 text-lg font-extrabold uppercase tracking-wide text-text-muted">Snooze for</h3>
          <div className="flex flex-wrap gap-3">
            {SNOOZE_CHOICES.map((choice) => (
              <button
                key={choice.days}
                onClick={() => onSnooze(choice.days)}
                disabled={busy}
                className="rounded-full px-5 py-3 text-lg font-extrabold transition active:scale-95 disabled:opacity-60"
                style={{ backgroundColor: "var(--color-primary-soft)", color: "var(--color-primary)" }}
              >
                {choice.label}
              </button>
            ))}
          </div>
        </section>

        <button
          onClick={onSkip}
          disabled={busy}
          className="w-full rounded-full border-2 border-border py-4 text-lg font-bold text-text-muted transition active:scale-[0.98] disabled:opacity-60"
        >
          Skip this occurrence
        </button>
      </div>
    </div>
  );
}
