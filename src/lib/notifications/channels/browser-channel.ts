import type { DueNotification, NotificationChannel } from "../types";

const REASON_TITLES: Record<DueNotification["reason"], (n: DueNotification) => string> = {
  overdue: (n) => `Overdue: ${n.taskName}`,
  due_today: (n) => `Due today: ${n.taskName}`,
  days_before: (n) => `Coming up: ${n.taskName}`,
  hours_before: (n) => `Due soon: ${n.taskName}`,
};

/**
 * Best-effort browser Notification API channel. Only fires while the PWA
 * tab/window is open and the user has granted permission — there is no
 * background push in v1. Client-only; never import this from server code.
 */
export function createBrowserNotificationChannel(): NotificationChannel {
  return {
    id: "browser-notification",
    isAvailable: () =>
      typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted",
    deliver: (notifications) => {
      if (typeof window === "undefined" || !("Notification" in window)) return;
      if (Notification.permission !== "granted") return;
      for (const notification of notifications) {
        new Notification(REASON_TITLES[notification.reason](notification), {
          body: notification.areaName,
          tag: `${notification.taskId}-${notification.reason}`,
        });
      }
    },
  };
}
