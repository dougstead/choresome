"use client";

import { useState } from "react";
import useSWR, { mutate as globalMutate } from "swr";
import { deleteJson, fetcher, patchJson } from "@/lib/client/fetcher";
import { formatRelativeTime } from "@/lib/format";
import { useMembers } from "@/hooks/use-household-data";
import { EditIcon } from "./icons";
import type { CompletionEventDto } from "@/lib/api/types";

function revalidateEverything() {
  return globalMutate((key) => typeof key === "string" && key.startsWith("/api/"), undefined, { revalidate: true });
}

function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function CompletionHistoryList({ taskId }: { taskId: string }) {
  const { data, mutate, isLoading } = useSWR<{ events: CompletionEventDto[]; nextCursor: string | null }>(
    `/api/completions?taskId=${taskId}&limit=15`,
    fetcher
  );
  const [extra, setExtra] = useState<CompletionEventDto[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const events = [...(data?.events ?? []), ...extra];
  const nextCursor = cursor !== null ? cursor : (data?.nextCursor ?? null);

  async function loadMore() {
    if (!nextCursor) return;
    setLoadingMore(true);
    try {
      const more = await fetcher<{ events: CompletionEventDto[]; nextCursor: string | null }>(
        `/api/completions?taskId=${taskId}&limit=15&cursor=${nextCursor}`
      );
      setExtra((prev) => [...prev, ...more.events]);
      setCursor(more.nextCursor);
    } finally {
      setLoadingMore(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this completion record? This can't be undone.")) return;
    await deleteJson(`/api/completions/${id}`);
    setExtra((prev) => prev.filter((e) => e.id !== id));
    await mutate();
    await revalidateEverything();
  }

  if (isLoading) {
    return <p className="text-sm text-text-muted">Loading history…</p>;
  }

  if (events.length === 0) {
    return (
      <p className="rounded-[var(--radius-card)] border border-dashed border-border p-4 text-center text-sm text-text-muted">
        Never completed.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {events.map((event) =>
        editingId === event.id ? (
          <CompletionEditForm
            key={event.id}
            event={event}
            onDone={async () => {
              setEditingId(null);
              await mutate();
              await revalidateEverything();
            }}
            onCancel={() => setEditingId(null)}
          />
        ) : (
          <div key={event.id} className="flex items-center gap-3 rounded-[var(--radius-card)] border border-border bg-surface p-3.5">
            <span className="text-xl">{event.member.icon}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold">
                {new Date(event.completedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                {" — "}
                {event.member.name}
              </span>
              <span className="block text-xs text-text-muted">
                {formatRelativeTime(event.completedAt)}
                {event.note ? ` · ${event.note}` : ""}
              </span>
            </span>
            <button
              onClick={() => setEditingId(event.id)}
              className="rounded-full p-2 text-text-muted"
              aria-label="Correct this record"
            >
              <EditIcon width={16} height={16} />
            </button>
            <button
              onClick={() => handleDelete(event.id)}
              className="rounded-full p-2 text-sm font-bold"
              style={{ color: "var(--color-overdue)" }}
              aria-label="Delete this record"
            >
              ✕
            </button>
          </div>
        )
      )}
      {nextCursor ? (
        <button
          onClick={loadMore}
          disabled={loadingMore}
          className="w-full rounded-[var(--radius-control)] border border-border py-2.5 text-sm font-bold text-text-muted"
        >
          {loadingMore ? "Loading…" : "Load more"}
        </button>
      ) : null}
    </div>
  );
}

function CompletionEditForm({
  event,
  onDone,
  onCancel,
}: {
  event: CompletionEventDto;
  onDone: () => void;
  onCancel: () => void;
}) {
  const { members } = useMembers();
  const [memberId, setMemberId] = useState(event.memberId);
  const [completedAt, setCompletedAt] = useState(toDatetimeLocal(event.completedAt));
  const [note, setNote] = useState(event.note ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await patchJson(`/api/completions/${event.id}`, {
        memberId,
        completedAt: new Date(completedAt).toISOString(),
        note: note.trim() || null,
      });
      onDone();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3 rounded-[var(--radius-card)] border-2 border-border bg-surface-alt p-3.5">
      <p className="text-xs font-bold uppercase tracking-wide text-text-muted">Correct this record</p>
      <select
        value={memberId}
        onChange={(e) => setMemberId(e.target.value)}
        className="w-full rounded-[var(--radius-control)] border border-border bg-surface px-3 py-2 text-sm"
      >
        {members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.icon} {m.name}
          </option>
        ))}
      </select>
      <input
        type="datetime-local"
        value={completedAt}
        onChange={(e) => setCompletedAt(e.target.value)}
        className="w-full rounded-[var(--radius-control)] border border-border bg-surface px-3 py-2 text-sm"
      />
      <input
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Note (optional)"
        className="w-full rounded-[var(--radius-control)] border border-border bg-surface px-3 py-2 text-sm"
      />
      <div className="flex gap-2">
        <button
          onClick={save}
          disabled={saving}
          className="flex-1 rounded-full py-2 text-sm font-bold"
          style={{ backgroundColor: "var(--color-primary)", color: "var(--color-primary-foreground)" }}
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button onClick={onCancel} className="flex-1 rounded-full border border-border py-2 text-sm font-bold text-text-muted">
          Cancel
        </button>
      </div>
    </div>
  );
}
