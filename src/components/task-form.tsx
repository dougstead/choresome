"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { describeRecurrence, type IntervalUnit, type RecurrenceRule } from "@/lib/recurrence";
import { calendarDateToIsoDate } from "@/lib/dates";
import { postJson, patchJson } from "@/lib/client/fetcher";
import { useAreas, useMembers } from "@/hooks/use-household-data";
import type { TaskDto } from "@/lib/api/types";

const ICONS = ["🧽", "🧹", "🧺", "🚿", "🛁", "🧻", "🍽️", "🪟", "🛏️", "🗑️", "🔥", "🧯", "🚗", "🌿", "💡"];
const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function todayCalendarDate() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
}

interface FormState {
  name: string;
  description: string;
  areaId: string;
  icon: string;
  priority: "LOW" | "MEDIUM" | "HIGH";
  defaultAssigneeId: string;
  estimatedDurationMinutes: string;
  mode: "relative" | "fixed";
  intervalValue: number;
  intervalUnit: IntervalUnit;
  fixedPattern: "weekly" | "monthly" | "annual";
  weekdays: number[];
  intervalWeeks: number;
  dayOfMonth: number;
  intervalMonths: number;
  annualMonth: number;
  annualDay: number;
  anchorDate: { year: number; month: number; day: number };
  allowJoint: boolean;
  reminderOnDue: boolean;
  reminderOnOverdue: boolean;
  reminderDaysBefore: string;
}

function initialStateFromTask(task: TaskDto | undefined): FormState {
  const base: FormState = {
    name: task?.name ?? "",
    description: task?.description ?? "",
    areaId: task?.areaId ?? "",
    icon: task?.icon ?? "🧽",
    priority: task?.priority ?? "MEDIUM",
    defaultAssigneeId: task?.defaultAssigneeId ?? "",
    estimatedDurationMinutes: task?.estimatedDurationMinutes ? String(task.estimatedDurationMinutes) : "",
    mode: "relative",
    intervalValue: 7,
    intervalUnit: "days",
    fixedPattern: "weekly",
    weekdays: [4],
    intervalWeeks: 1,
    dayOfMonth: 1,
    intervalMonths: 1,
    annualMonth: 1,
    annualDay: 1,
    anchorDate: todayCalendarDate(),
    allowJoint: task?.allowJoint ?? false,
    reminderOnDue: task?.reminderConfig?.onDue ?? true,
    reminderOnOverdue: task?.reminderConfig?.onOverdue ?? true,
    reminderDaysBefore: task?.reminderConfig?.daysBefore?.[0] ? String(task.reminderConfig.daysBefore[0]) : "",
  };

  const rule = task?.recurrenceRule;
  if (!rule) return base;

  if (rule.type === "COMPLETION_RELATIVE") {
    return { ...base, mode: "relative", intervalValue: rule.intervalValue, intervalUnit: rule.intervalUnit };
  }

  if (rule.pattern.pattern === "weekly") {
    return {
      ...base,
      mode: "fixed",
      fixedPattern: "weekly",
      weekdays: rule.pattern.weekdays,
      intervalWeeks: rule.pattern.intervalWeeks,
      anchorDate: rule.pattern.anchorDate,
    };
  }
  if (rule.pattern.pattern === "monthly") {
    return {
      ...base,
      mode: "fixed",
      fixedPattern: "monthly",
      dayOfMonth: rule.pattern.dayOfMonth,
      intervalMonths: rule.pattern.intervalMonths,
      anchorDate: rule.pattern.anchorDate,
    };
  }
  return { ...base, mode: "fixed", fixedPattern: "annual", annualMonth: rule.pattern.month, annualDay: rule.pattern.day };
}

function buildRule(state: FormState): RecurrenceRule {
  if (state.mode === "relative") {
    return { type: "COMPLETION_RELATIVE", intervalValue: state.intervalValue, intervalUnit: state.intervalUnit };
  }
  if (state.fixedPattern === "weekly") {
    return {
      type: "FIXED_CALENDAR",
      pattern: {
        pattern: "weekly",
        weekdays: state.weekdays.length > 0 ? state.weekdays : [todayCalendarDate().year % 7],
        intervalWeeks: state.intervalWeeks,
        anchorDate: state.anchorDate,
      },
    };
  }
  if (state.fixedPattern === "monthly") {
    return {
      type: "FIXED_CALENDAR",
      pattern: { pattern: "monthly", dayOfMonth: state.dayOfMonth, intervalMonths: state.intervalMonths, anchorDate: state.anchorDate },
    };
  }
  return { type: "FIXED_CALENDAR", pattern: { pattern: "annual", month: state.annualMonth, day: state.annualDay } };
}

export function TaskForm({ task, defaultAreaId }: { task?: TaskDto; defaultAreaId?: string }) {
  const router = useRouter();
  const { areas } = useAreas();
  const { members } = useMembers();
  const [state, setState] = useState<FormState>(() => {
    const initial = initialStateFromTask(task);
    return defaultAreaId && !task ? { ...initial, areaId: defaultAreaId } : initial;
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setState((prev) => ({ ...prev, [key]: value }));
  }

  const rule = useMemo(() => buildRule(state), [state]);
  const summary = useMemo(() => {
    try {
      return describeRecurrence(rule);
    } catch {
      return "";
    }
  }, [rule]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!state.name.trim()) {
      setError("Give the task a name.");
      return;
    }
    if (!state.areaId) {
      setError("Choose an area.");
      return;
    }
    setSubmitting(true);
    try {
      const daysBefore = state.reminderDaysBefore.trim() ? [Number(state.reminderDaysBefore)] : [];
      const payload = {
        name: state.name.trim(),
        description: state.description.trim() || undefined,
        areaId: state.areaId,
        icon: state.icon,
        priority: state.priority,
        allowJoint: state.allowJoint,
        defaultAssigneeId: state.defaultAssigneeId || null,
        estimatedDurationMinutes: state.estimatedDurationMinutes ? Number(state.estimatedDurationMinutes) : null,
        recurrenceRule: rule,
        reminderConfig: { onDue: state.reminderOnDue, onOverdue: state.reminderOnOverdue, daysBefore, hoursBefore: [] },
      };
      if (task) {
        await patchJson(`/api/tasks/${task.id}`, payload);
        router.push(`/tasks/${task.id}`);
      } else {
        const result = await postJson<{ task: TaskDto }>("/api/tasks", payload);
        router.push(`/tasks/${result.task.id}`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 pb-10">
      <label className="block">
        <span className="mb-1.5 block text-sm font-bold">Task name</span>
        <input
          value={state.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="Clean oven"
          className="w-full rounded-[var(--radius-control)] border border-border bg-surface px-4 py-3 text-base"
        />
      </label>

      <div>
        <span className="mb-1.5 block text-sm font-bold">Icon</span>
        <div className="flex flex-wrap gap-2">
          {ICONS.map((icon) => (
            <button
              key={icon}
              type="button"
              onClick={() => set("icon", icon)}
              className="flex h-11 w-11 items-center justify-center rounded-xl border-2 text-xl"
              style={{ borderColor: state.icon === icon ? "var(--color-primary)" : "var(--color-border)" }}
            >
              {icon}
            </button>
          ))}
        </div>
      </div>

      <label className="block">
        <span className="mb-1.5 block text-sm font-bold">Area</span>
        <select
          value={state.areaId}
          onChange={(e) => set("areaId", e.target.value)}
          className="w-full rounded-[var(--radius-control)] border border-border bg-surface px-4 py-3 text-base"
        >
          <option value="">Choose an area…</option>
          {areas.map((area) => (
            <option key={area.id} value={area.id}>
              {area.icon} {area.name}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-bold">Notes (optional)</span>
        <textarea
          value={state.description}
          onChange={(e) => set("description", e.target.value)}
          rows={3}
          className="w-full rounded-[var(--radius-control)] border border-border bg-surface px-4 py-3 text-base"
        />
      </label>

      <fieldset className="rounded-[var(--radius-card)] border border-border p-4">
        <legend className="px-1 text-sm font-extrabold">Schedule</legend>

        <div className="mt-2 flex gap-2">
          <ModeButton active={state.mode === "relative"} onClick={() => set("mode", "relative")}>
            After completion
          </ModeButton>
          <ModeButton active={state.mode === "fixed"} onClick={() => set("mode", "fixed")}>
            Fixed calendar
          </ModeButton>
        </div>

        {state.mode === "relative" ? (
          <div className="mt-4 flex items-center gap-2">
            <span className="text-sm">Every</span>
            <input
              type="number"
              min={1}
              value={state.intervalValue}
              onChange={(e) => set("intervalValue", Math.max(1, Number(e.target.value)))}
              className="w-20 rounded-[var(--radius-control)] border border-border bg-surface px-3 py-2 text-base"
            />
            <select
              value={state.intervalUnit}
              onChange={(e) => set("intervalUnit", e.target.value as IntervalUnit)}
              className="rounded-[var(--radius-control)] border border-border bg-surface px-3 py-2 text-base"
            >
              <option value="days">days</option>
              <option value="weeks">weeks</option>
              <option value="months">months</option>
              <option value="years">years</option>
            </select>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="flex gap-2">
              <ModeButton active={state.fixedPattern === "weekly"} onClick={() => set("fixedPattern", "weekly")} small>
                Weekly
              </ModeButton>
              <ModeButton active={state.fixedPattern === "monthly"} onClick={() => set("fixedPattern", "monthly")} small>
                Monthly
              </ModeButton>
              <ModeButton active={state.fixedPattern === "annual"} onClick={() => set("fixedPattern", "annual")} small>
                Annual
              </ModeButton>
            </div>

            {state.fixedPattern === "weekly" && (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  {WEEKDAY_LABELS.map((label, index) => {
                    const active = state.weekdays.includes(index);
                    return (
                      <button
                        key={label}
                        type="button"
                        onClick={() =>
                          set(
                            "weekdays",
                            active ? state.weekdays.filter((d) => d !== index) : [...state.weekdays, index].sort()
                          )
                        }
                        className="flex h-10 w-12 items-center justify-center rounded-lg border-2 text-xs font-bold"
                        style={{ borderColor: active ? "var(--color-primary)" : "var(--color-border)" }}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span>Every</span>
                  <input
                    type="number"
                    min={1}
                    value={state.intervalWeeks}
                    onChange={(e) => set("intervalWeeks", Math.max(1, Number(e.target.value)))}
                    className="w-16 rounded-[var(--radius-control)] border border-border bg-surface px-2 py-1.5"
                  />
                  <span>week(s)</span>
                </div>
              </div>
            )}

            {state.fixedPattern === "monthly" && (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span>Day</span>
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={state.dayOfMonth}
                  onChange={(e) => set("dayOfMonth", Math.min(31, Math.max(1, Number(e.target.value))))}
                  className="w-16 rounded-[var(--radius-control)] border border-border bg-surface px-2 py-1.5"
                />
                <span>of the month, every</span>
                <input
                  type="number"
                  min={1}
                  value={state.intervalMonths}
                  onChange={(e) => set("intervalMonths", Math.max(1, Number(e.target.value)))}
                  className="w-16 rounded-[var(--radius-control)] border border-border bg-surface px-2 py-1.5"
                />
                <span>month(s)</span>
              </div>
            )}

            {state.fixedPattern !== "annual" && (
              <label className="block text-sm">
                <span className="font-semibold">Starting from</span>
                <input
                  type="date"
                  value={calendarDateToIsoDate(state.anchorDate)}
                  onChange={(e) => {
                    const [year, month, day] = e.target.value.split("-").map(Number);
                    if (year && month && day) set("anchorDate", { year, month, day });
                  }}
                  className="ml-2 rounded-[var(--radius-control)] border border-border bg-surface px-2 py-1.5"
                />
                <span className="mt-1 block text-xs text-text-muted">
                  Nothing is due before this date. For &ldquo;every 2 weeks&rdquo; or longer, pick a date in a week
                  it <em>should</em> happen &mdash; that fixes which weeks count.
                </span>
              </label>
            )}

            {state.fixedPattern === "annual" && (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <select
                  value={state.annualMonth}
                  onChange={(e) => set("annualMonth", Number(e.target.value))}
                  className="rounded-[var(--radius-control)] border border-border bg-surface px-2 py-1.5"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>
                      {new Date(2000, m - 1, 1).toLocaleDateString("en-GB", { month: "long" })}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={state.annualDay}
                  onChange={(e) => set("annualDay", Math.min(31, Math.max(1, Number(e.target.value))))}
                  className="w-16 rounded-[var(--radius-control)] border border-border bg-surface px-2 py-1.5"
                />
              </div>
            )}
          </div>
        )}

        {summary ? <p className="mt-3 text-sm font-semibold" style={{ color: "var(--color-primary)" }}>{summary}</p> : null}
      </fieldset>

      <fieldset className="rounded-[var(--radius-card)] border border-border p-4">
        <legend className="px-1 text-sm font-extrabold">Reminders</legend>
        <label className="mt-2 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={state.reminderOnDue} onChange={(e) => set("reminderOnDue", e.target.checked)} />
          Notify when due
        </label>
        <label className="mt-2 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={state.reminderOnOverdue}
            onChange={(e) => set("reminderOnOverdue", e.target.checked)}
          />
          Notify when overdue
        </label>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <span>Remind</span>
          <input
            type="number"
            min={0}
            value={state.reminderDaysBefore}
            onChange={(e) => set("reminderDaysBefore", e.target.value)}
            placeholder="—"
            className="w-16 rounded-[var(--radius-control)] border border-border bg-surface px-2 py-1.5"
          />
          <span>days before</span>
        </label>
      </fieldset>

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={state.allowJoint}
          onChange={(e) => set("allowJoint", e.target.checked)}
        />
        <span>
          <span className="font-bold">Can be done jointly</span>
          <span className="block text-xs text-text-muted">
            Completing always asks who did it, with a &ldquo;Joint effort&rdquo; option that credits everyone.
          </span>
        </span>
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-bold">Default assignee</span>
        <select
          value={state.defaultAssigneeId}
          onChange={(e) => set("defaultAssigneeId", e.target.value)}
          className="w-full rounded-[var(--radius-control)] border border-border bg-surface px-4 py-3 text-base"
        >
          <option value="">Anyone</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.icon} {m.name}
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-2 gap-4">
        <label className="block">
          <span className="mb-1.5 block text-sm font-bold">Priority</span>
          <select
            value={state.priority}
            onChange={(e) => set("priority", e.target.value as FormState["priority"])}
            className="w-full rounded-[var(--radius-control)] border border-border bg-surface px-4 py-3 text-base"
          >
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-bold">Est. minutes</span>
          <input
            type="number"
            min={1}
            value={state.estimatedDurationMinutes}
            onChange={(e) => set("estimatedDurationMinutes", e.target.value)}
            placeholder="—"
            className="w-full rounded-[var(--radius-control)] border border-border bg-surface px-4 py-3 text-base"
          />
        </label>
      </div>

      {error ? <p className="text-sm font-semibold text-[var(--color-overdue)]">{error}</p> : null}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-full py-3.5 text-center text-base font-extrabold disabled:opacity-60"
        style={{ backgroundColor: "var(--color-primary)", color: "var(--color-primary-foreground)" }}
      >
        {submitting ? "Saving…" : task ? "Save changes" : "Add task"}
      </button>
    </form>
  );
}

function ModeButton({
  active,
  onClick,
  children,
  small,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  small?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border-2 font-bold ${small ? "px-3 py-1.5 text-xs" : "flex-1 py-2.5 text-sm"}`}
      style={{
        borderColor: active ? "var(--color-primary)" : "var(--color-border)",
        backgroundColor: active ? "var(--color-primary-soft)" : "transparent",
        color: active ? "var(--color-primary)" : "var(--color-text)",
      }}
    >
      {children}
    </button>
  );
}
