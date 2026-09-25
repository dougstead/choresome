"use client";

import { useEffect, useRef } from "react";
import useSWR from "swr";
import { computeDueNotifications, type NotifiableTask } from "@/lib/notifications/compute-due-notifications";
import { createBrowserNotificationChannel } from "@/lib/notifications/channels/browser-channel";
import { instantToCalendarDate } from "@/lib/dates";
import { fetcher } from "@/lib/client/fetcher";
import { DEFAULT_REMINDER_CONFIG } from "@/lib/validation/recurrence";
import type { TaskDto } from "@/lib/api/types";
import type { HouseholdSettings } from "@/lib/services/settings-service";

const CHECK_INTERVAL_MS = 60_000;
const SHOWN_KEY = "choresome:shownNotifications";

function loadShown(): Set<string> {
  try {
    const raw = window.localStorage.getItem(SHOWN_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function saveShown(shown: Set<string>) {
  try {
    // Keep this bounded — only today's entries are useful.
    window.localStorage.setItem(SHOWN_KEY, JSON.stringify(Array.from(shown).slice(-500)));
  } catch {
    // Storage unavailable — notifications just won't dedupe across reloads today.
  }
}

/**
 * Foreground, best-effort reminder polling. While the PWA is open and the
 * browser Notification permission is granted, checks roughly once a minute
 * for tasks that have newly crossed a reminder threshold and fires a native
 * notification. There is no background delivery when the app is fully
 * closed — see NotificationChannel in lib/notifications for how another
 * delivery mechanism (e.g. Web Push) could be added later.
 */
export function useDueNotifications(settings: HouseholdSettings | undefined) {
  const { data } = useSWR<{ tasks: TaskDto[] }>("/api/tasks", fetcher, { refreshInterval: CHECK_INTERVAL_MS });
  const shownRef = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!settings || !data) return;
    if (shownRef.current === null) shownRef.current = loadShown();
    const shown = shownRef.current;

    const channel = createBrowserNotificationChannel();
    if (!channel.isAvailable()) return;

    const today = instantToCalendarDate(new Date(), settings.timezone);
    const notifiable: NotifiableTask[] = data.tasks
      .filter((t) => t.active)
      .map((t) => ({
        taskId: t.id,
        taskName: t.name,
        areaName: t.area.name,
        dueDate: { year: Number(t.dueDate.slice(0, 4)), month: Number(t.dueDate.slice(5, 7)), day: Number(t.dueDate.slice(8, 10)) },
        reminderConfig: t.reminderConfig ?? settings.reminderDefaults ?? DEFAULT_REMINDER_CONFIG,
      }));

    const due = computeDueNotifications(notifiable, { now: new Date(), today, timeZone: settings.timezone });
    const todayKey = `${today.year}-${today.month}-${today.day}`;
    const fresh = due.filter((n) => !shown.has(`${todayKey}:${n.taskId}:${n.reason}`));
    if (fresh.length === 0) return;

    channel.deliver(fresh);
    for (const n of fresh) shown.add(`${todayKey}:${n.taskId}:${n.reason}`);
    saveShown(shown);
  }, [data, settings]);
}
