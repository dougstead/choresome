export type DueNotificationReason = "days_before" | "hours_before" | "due_today" | "overdue";

export interface DueNotification {
  taskId: string;
  taskName: string;
  areaName: string;
  reason: DueNotificationReason;
  /** For overdue tasks, how many days overdue; for upcoming reminders, days until due. */
  daysFromDue: number;
}

/**
 * A delivery mechanism for DueNotifications. v1 ships an in-app list (always
 * available) and a foreground browser Notification channel (best-effort,
 * requires the PWA to be open and permission granted). Server-driven push
 * (Web Push + VAPID) can be added later behind this same interface.
 */
export interface NotificationChannel {
  id: string;
  isAvailable(): boolean;
  deliver(notifications: DueNotification[]): void | Promise<void>;
}
