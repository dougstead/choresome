"use client";

import { useOnlineStatus } from "@/hooks/use-online-status";

export function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;

  return (
    <div
      className="fixed inset-x-0 top-0 z-[60] px-4 py-2 text-center text-sm font-bold text-white"
      style={{ backgroundColor: "var(--color-overdue)", paddingTop: "calc(env(safe-area-inset-top) + 0.5rem)" }}
      role="status"
    >
      Offline — can&apos;t reach the household server. Actions won&apos;t go through until you&apos;re back online.
    </div>
  );
}
