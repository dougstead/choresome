"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CheckIcon, UndoIcon } from "./icons";
import { MemberPickerSheet } from "./member-picker-sheet";
import { useMembers } from "@/hooks/use-household-data";
import { getPreferredMemberId, setPreferredMemberId } from "@/lib/client/member-preference";
import { ApiError, deleteJson, postJson } from "@/lib/client/fetcher";
import { formatDate, formatRelativeTime } from "@/lib/format";

interface CompleteResponse {
  duplicate: boolean;
  event: { id: string; completedAt: string; note: string | null };
  member: { id: string; name: string; icon: string };
  task: { id: string; name: string; icon: string; dueDate: string };
}

type Phase = "loading" | "picking" | "posting" | "success" | "undone" | "error";

export function NfcCompleteScreen({ token, dateFormat }: { token: string; dateFormat: string }) {
  const { members } = useMembers();
  const [phase, setPhase] = useState<Phase>("loading");
  const [result, setResult] = useState<CompleteResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const attempted = useRef(false);

  const complete = useCallback(
    async (memberId: string) => {
      setPhase("posting");
      try {
        const data = await postJson<CompleteResponse>(`/api/nfc/${token}/complete`, { memberId });
        setResult(data);
        setPhase("success");
      } catch (err) {
        if (err instanceof ApiError && err.code === "invalid_member") {
          // This device's remembered person doesn't exist any more (e.g. removed,
          // or the household was reset/restored) — forget it and ask again instead
          // of showing a dead end.
          setPreferredMemberId(null);
          setPhase("picking");
          return;
        }
        setErrorMessage(err instanceof ApiError ? err.message : "Something went wrong.");
        setPhase("error");
      }
    },
    [token]
  );

  // Reads localStorage and (if a device member is already known) immediately posts
  // the completion — this IS the "tap tag -> done" flow, so it belongs on mount.
  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;
    const preferred = getPreferredMemberId();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (preferred) void complete(preferred);
    else setPhase("picking");
  }, [complete]);

  async function handlePick(memberId: string) {
    setPreferredMemberId(memberId);
    await complete(memberId);
  }

  async function handleUndo() {
    if (!result) return;
    setPhase("posting");
    await deleteJson(`/api/completions/${result.event.id}`);
    setPhase("undone");
  }

  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-5 px-6 py-10 text-center">
      {(phase === "loading" || phase === "posting") && (
        <p className="text-lg font-semibold text-text-muted">
          {phase === "posting" && result ? "Undoing…" : "Completing…"}
        </p>
      )}

      {phase === "picking" && (
        <MemberPickerSheet
          title="Who's completing this?"
          members={members}
          onSelect={handlePick}
          onClose={() => setPhase("error") /* nowhere else to go without a member */}
        />
      )}

      {phase === "success" && result && (
        <>
          <div
            className="flex h-20 w-20 items-center justify-center rounded-full"
            style={{ backgroundColor: "var(--color-done-soft)" }}
          >
            <CheckIcon width={40} height={40} strokeWidth={3} style={{ color: "var(--color-done)" }} />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold">
              {result.task.icon} {result.task.name}
            </h1>
            <p className="mt-2 text-text-muted">
              Completed by <span className="font-bold text-text">{result.member.name}</span>
            </p>
            <p className="text-sm text-text-muted">{formatRelativeTime(result.event.completedAt)}</p>
            <p className="mt-3 text-sm font-semibold">Next due: {formatDate(result.task.dueDate, dateFormat)}</p>
          </div>
          <button
            onClick={handleUndo}
            className="mt-2 flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-bold text-text-muted"
          >
            <UndoIcon width={16} height={16} />
            Undo
          </button>
          <Link href={`/tasks/${result.task.id}`} className="text-sm font-bold text-text-muted underline underline-offset-2">
            View full task
          </Link>
        </>
      )}

      {phase === "undone" && (
        <>
          <p className="text-lg font-bold">Undone</p>
          <p className="text-sm text-text-muted">That completion was removed.</p>
          <Link href="/" className="text-sm font-bold underline underline-offset-2" style={{ color: "var(--color-primary)" }}>
            Back to dashboard
          </Link>
        </>
      )}

      {phase === "error" && (
        <>
          <p className="text-lg font-bold">Couldn&rsquo;t complete this</p>
          <p className="text-sm text-text-muted">{errorMessage || "Pick who you are to try again."}</p>
          <Link href="/" className="text-sm font-bold underline underline-offset-2" style={{ color: "var(--color-primary)" }}>
            Back to dashboard
          </Link>
        </>
      )}
    </div>
  );
}
