"use client";

import { useSettings } from "@/hooks/use-household-data";
import { useHolidayMode } from "@/hooks/use-holiday-mode";
import { formatDate } from "@/lib/format";

export function HolidayModeCard() {
  const { settings } = useSettings();
  const { setHolidayMode, busy } = useHolidayMode();

  if (!settings) return null;

  return (
    <div className="space-y-3 rounded-[var(--radius-card)] border border-border bg-surface p-4">
      <h2 className="text-sm font-extrabold uppercase tracking-wide text-text-muted">Holiday mode</h2>
      <p className="text-xs text-text-muted">
        Pauses every task&apos;s due-date clock while you&apos;re away, so nothing racks up as overdue. Turning it
        back off picks up exactly where things were and shifts every schedule forward by however many days you were
        away.
      </p>
      {settings.holidayMode ? (
        <>
          <p className="text-sm font-bold" style={{ color: "var(--color-primary)" }}>
            🏖️ Paused since{" "}
            {settings.holidayStartedAt ? formatDate(new Date(settings.holidayStartedAt), settings.dateFormat) : "—"}
          </p>
          <button
            onClick={() => setHolidayMode(false)}
            disabled={busy}
            className="w-full rounded-full py-2.5 text-sm font-extrabold disabled:opacity-60"
            style={{ backgroundColor: "var(--color-primary)", color: "var(--color-primary-foreground)" }}
          >
            {busy ? "Ending…" : "We're back — end holiday mode"}
          </button>
        </>
      ) : (
        <button
          onClick={() => setHolidayMode(true)}
          disabled={busy}
          className="w-full rounded-full border-2 border-border py-2.5 text-sm font-extrabold text-text-muted disabled:opacity-60"
        >
          {busy ? "Starting…" : "Start holiday mode"}
        </button>
      )}
    </div>
  );
}
