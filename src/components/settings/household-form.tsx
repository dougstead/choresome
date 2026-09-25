"use client";

import { useEffect, useState } from "react";
import { mutate as globalMutate } from "swr";
import { useSettings } from "@/hooks/use-household-data";
import { patchJson } from "@/lib/client/fetcher";

const DATE_FORMATS = ["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD", "DD MMM YYYY"];

function revalidateSettings() {
  return globalMutate((key) => typeof key === "string" && key.startsWith("/api/"), undefined, { revalidate: true });
}

export function HouseholdForm() {
  const { settings } = useSettings();
  const [name, setName] = useState("");
  const [dateFormat, setDateFormat] = useState("DD/MM/YYYY");
  const [timeFormat, setTimeFormat] = useState<"12h" | "24h">("24h");
  const [theme, setTheme] = useState<"SYSTEM" | "LIGHT" | "DARK">("SYSTEM");
  const [upcomingWindowDays, setUpcomingWindowDays] = useState(3);
  const [reminderOnDue, setReminderOnDue] = useState(true);
  const [reminderOnOverdue, setReminderOnOverdue] = useState(true);
  const [reminderDaysBefore, setReminderDaysBefore] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Seeds editable local state once the household settings arrive from SWR.
  useEffect(() => {
    if (!settings) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setName(settings.name);
    setDateFormat(settings.dateFormat);
    setTimeFormat(settings.timeFormat as "12h" | "24h");
    setTheme(settings.theme);
    setUpcomingWindowDays(settings.upcomingWindowDays);
    setReminderOnDue(settings.reminderDefaults.onDue);
    setReminderOnOverdue(settings.reminderDefaults.onOverdue);
    setReminderDaysBefore(settings.reminderDefaults.daysBefore[0] ? String(settings.reminderDefaults.daysBefore[0]) : "");
  }, [settings]);

  async function save() {
    setSaving(true);
    try {
      const reminderDefaults = {
        onDue: reminderOnDue,
        onOverdue: reminderOnOverdue,
        daysBefore: reminderDaysBefore.trim() ? [Number(reminderDaysBefore)] : [],
        hoursBefore: [],
      };
      await patchJson("/api/settings", { name, dateFormat, timeFormat, theme, upcomingWindowDays, reminderDefaults });
      await revalidateSettings();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      // Theme is applied via a server-rendered data-theme attribute; a full reload
      // is the simplest way to reflect a change immediately everywhere.
      window.location.reload();
    } finally {
      setSaving(false);
    }
  }

  if (!settings) return null;

  return (
    <div className="space-y-4 rounded-[var(--radius-card)] border border-border bg-surface p-4">
      <h2 className="text-sm font-extrabold uppercase tracking-wide text-text-muted">Household</h2>

      <label className="block">
        <span className="mb-1 block text-sm font-bold">Household name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-[var(--radius-control)] border border-border bg-surface-alt px-3 py-2.5 text-base"
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-sm font-bold">Date format</span>
          <select
            value={dateFormat}
            onChange={(e) => setDateFormat(e.target.value)}
            className="w-full rounded-[var(--radius-control)] border border-border bg-surface-alt px-3 py-2.5 text-sm"
          >
            {DATE_FORMATS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-bold">Time format</span>
          <select
            value={timeFormat}
            onChange={(e) => setTimeFormat(e.target.value as "12h" | "24h")}
            className="w-full rounded-[var(--radius-control)] border border-border bg-surface-alt px-3 py-2.5 text-sm"
          >
            <option value="24h">24-hour</option>
            <option value="12h">12-hour</option>
          </select>
        </label>
      </div>

      <label className="block">
        <span className="mb-1 block text-sm font-bold">Theme</span>
        <div className="flex gap-2">
          {(["SYSTEM", "LIGHT", "DARK"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTheme(t)}
              className="flex-1 rounded-full border-2 py-2 text-sm font-bold capitalize"
              style={{
                borderColor: theme === t ? "var(--color-primary)" : "var(--color-border)",
                backgroundColor: theme === t ? "var(--color-primary-soft)" : "transparent",
                color: theme === t ? "var(--color-primary)" : "var(--color-text)",
              }}
            >
              {t.toLowerCase()}
            </button>
          ))}
        </div>
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-bold">&ldquo;Coming up&rdquo; window</span>
        <div className="flex items-center gap-2 text-sm">
          <input
            type="number"
            min={1}
            max={30}
            value={upcomingWindowDays}
            onChange={(e) => setUpcomingWindowDays(Number(e.target.value))}
            className="w-20 rounded-[var(--radius-control)] border border-border bg-surface-alt px-3 py-2"
          />
          <span className="text-text-muted">days ahead</span>
        </div>
      </label>

      <div>
        <span className="mb-1.5 block text-sm font-bold">Default reminders</span>
        <p className="mb-2 text-xs text-text-muted">
          Applied to tasks that don&rsquo;t set their own reminder options.
        </p>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={reminderOnDue} onChange={(e) => setReminderOnDue(e.target.checked)} />
          Notify when due
        </label>
        <label className="mt-2 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={reminderOnOverdue} onChange={(e) => setReminderOnOverdue(e.target.checked)} />
          Notify when overdue
        </label>
        <label className="mt-2 flex items-center gap-2 text-sm">
          <span>Remind</span>
          <input
            type="number"
            min={0}
            value={reminderDaysBefore}
            onChange={(e) => setReminderDaysBefore(e.target.value)}
            placeholder="—"
            className="w-16 rounded-[var(--radius-control)] border border-border bg-surface-alt px-2 py-1.5"
          />
          <span>days before</span>
        </label>
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="w-full rounded-full py-2.5 text-sm font-extrabold disabled:opacity-60"
        style={{ backgroundColor: "var(--color-primary)", color: "var(--color-primary-foreground)" }}
      >
        {saving ? "Saving…" : saved ? "Saved ✓" : "Save"}
      </button>
    </div>
  );
}
