"use client";

import { useState } from "react";
import { mutate as globalMutate } from "swr";
import { postJson } from "@/lib/client/fetcher";
import { useUndoToast } from "@/components/undo-toast-provider";

function revalidateEverything() {
  return globalMutate((key) => typeof key === "string" && key.startsWith("/api/"), undefined, { revalidate: true });
}

interface HolidayModeResult {
  holidayMode: boolean;
  holidayStartedAt: string | null;
  daysPaused: number;
  tasksShifted: number;
}

/** Shared "turn Holiday mode on/off" action, used by both the Settings card and the dashboard banner. */
export function useHolidayMode() {
  const { show } = useUndoToast();
  const [busy, setBusy] = useState(false);

  async function setHolidayMode(enabled: boolean) {
    setBusy(true);
    try {
      const { result } = await postJson<{ result: HolidayModeResult }>("/api/settings/holiday-mode", { enabled });
      await revalidateEverything();
      if (enabled) {
        show("Holiday mode is on — due dates are paused until you turn it off.");
      } else if (result.tasksShifted > 0) {
        const days = `${result.daysPaused} day${result.daysPaused === 1 ? "" : "s"}`;
        const tasks = `${result.tasksShifted} task${result.tasksShifted === 1 ? "" : "s"}`;
        show(`Welcome back! Shifted ${tasks} forward by ${days}.`);
      } else {
        show("Holiday mode turned off.");
      }
    } finally {
      setBusy(false);
    }
  }

  return { setHolidayMode, busy };
}
