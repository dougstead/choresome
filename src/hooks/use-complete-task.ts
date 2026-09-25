"use client";

import { useCallback, useState } from "react";
import { mutate as globalMutate } from "swr";
import { useUndoToast } from "@/components/undo-toast-provider";
import { deleteJson, postJson } from "@/lib/client/fetcher";
import { getPreferredMemberId } from "@/lib/client/member-preference";
import { JOINT_CHOICE } from "@/components/member-picker-sheet";

function revalidateEverything() {
  return globalMutate((key) => typeof key === "string" && key.startsWith("/api/"), undefined, {
    revalidate: true,
  });
}

interface CompleteResponse {
  event: { id: string };
  duplicate: boolean;
}

/**
 * Drives the "tap task -> (maybe pick who) -> complete -> undo toast" flow
 * used on the dashboard, area view, task detail and the Pixel display.
 */
export function useCompleteTask() {
  const { show } = useUndoToast();
  const [pendingTask, setPendingTask] = useState<{ id: string; name: string; allowJoint: boolean } | null>(null);
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);

  const completeWithMember = useCallback(
    async (taskId: string, memberId: string, taskName: string) => {
      // memberId may be JOINT_CHOICE, meaning "Joint effort".
      setBusyTaskId(taskId);
      setPendingTask(null);
      try {
        const result = await postJson<CompleteResponse>(`/api/tasks/${taskId}/complete`,
          memberId === JOINT_CHOICE ? { joint: true } : { memberId }
        );
        await revalidateEverything();
        if (!result.duplicate) {
          show(`${taskName} completed`, async () => {
            await deleteJson(`/api/completions/${result.event.id}`);
            await revalidateEverything();
          });
        }
      } finally {
        setBusyTaskId(null);
      }
    },
    [show]
  );

  const requestComplete = useCallback(
    (taskId: string, taskName: string, allowJoint = false) => {
      if (busyTaskId) return; // ignore taps while a request is in flight
      const preferred = getPreferredMemberId();
      // Tasks that can be done jointly always ask, so "Joint effort" stays a choice.
      if (preferred && !allowJoint) {
        void completeWithMember(taskId, preferred, taskName);
      } else {
        setPendingTask({ id: taskId, name: taskName, allowJoint });
      }
    },
    [busyTaskId, completeWithMember]
  );

  return {
    requestComplete,
    completeWithMember,
    pendingTask,
    cancelPending: () => setPendingTask(null),
    busyTaskId,
  };
}
