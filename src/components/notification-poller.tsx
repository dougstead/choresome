"use client";

import { useSettings } from "@/hooks/use-household-data";
import { useDueNotifications } from "@/hooks/use-due-notifications";

/** Invisible: just keeps the foreground reminder check running while the app is open. */
export function NotificationPoller() {
  const { settings } = useSettings();
  useDueNotifications(settings);
  return null;
}
