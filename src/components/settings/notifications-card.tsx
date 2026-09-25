"use client";

import { useEffect, useState } from "react";

type PermissionState = "default" | "granted" | "denied" | "unsupported";

export function NotificationsCard() {
  const [permission, setPermission] = useState<PermissionState>("default");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reads a browser-only API
    setPermission(typeof Notification === "undefined" ? "unsupported" : (Notification.permission as PermissionState));
  }, []);

  async function requestPermission() {
    if (typeof Notification === "undefined") return;
    const result = await Notification.requestPermission();
    setPermission(result as PermissionState);
  }

  return (
    <div className="space-y-3 rounded-[var(--radius-card)] border border-border bg-surface p-4">
      <h2 className="text-sm font-extrabold uppercase tracking-wide text-text-muted">Notifications</h2>
      <p className="text-xs text-text-muted">
        While this app is open in a tab or installed as a PWA, it can show reminders for tasks that are due or
        overdue. This only works in the foreground — there&apos;s no notification when the app is fully closed. The
        dashboard is always accurate either way.
      </p>
      {permission === "unsupported" ? (
        <p className="text-xs font-semibold text-text-muted">Not supported on this browser.</p>
      ) : permission === "granted" ? (
        <p className="text-xs font-bold" style={{ color: "var(--color-primary)" }}>
          Notifications enabled ✓
        </p>
      ) : permission === "denied" ? (
        <p className="text-xs font-semibold text-text-muted">
          Notifications are blocked for this site in your browser settings.
        </p>
      ) : (
        <button
          onClick={requestPermission}
          className="rounded-full px-4 py-2 text-sm font-bold"
          style={{ backgroundColor: "var(--color-primary-soft)", color: "var(--color-primary)" }}
        >
          Enable notifications
        </button>
      )}
    </div>
  );
}
