import type { DueNotification, NotificationChannel } from "../types";

/** Always-available channel: just hands notifications to a UI callback (e.g. a banner list). */
export function createInAppChannel(onNotify: (notifications: DueNotification[]) => void): NotificationChannel {
  return {
    id: "in-app",
    isAvailable: () => true,
    deliver: (notifications) => onNotify(notifications),
  };
}
