"use client";

import { useState } from "react";
import useSWR, { mutate as globalMutate } from "swr";
import { QrCodeImage } from "@/components/qr-code-image";
import { useTasks } from "@/hooks/use-household-data";
import { fetcher, patchJson, postJson } from "@/lib/client/fetcher";
import { formatRelativeTime } from "@/lib/format";
import type { NfcTagDto } from "@/lib/api/types";

function revalidate() {
  return globalMutate((key) => typeof key === "string" && key.startsWith("/api/"), undefined, { revalidate: true });
}

function tagUrl(token: string): string {
  if (typeof window === "undefined") return `/nfc/complete/${token}`;
  return `${window.location.origin}/nfc/complete/${token}`;
}

export function NfcTagsManager() {
  const { data, isLoading } = useSWR<{ tags: NfcTagDto[] }>("/api/nfc-tags", fetcher);
  const { tasks } = useTasks();
  const [creating, setCreating] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function addTag() {
    setCreating(true);
    try {
      await postJson("/api/nfc-tags", {});
      await revalidate();
    } finally {
      setCreating(false);
    }
  }

  async function renameTag(id: string, label: string) {
    await patchJson(`/api/nfc-tags/${id}`, { label });
    await revalidate();
  }

  async function assignTag(id: string, taskId: string) {
    await patchJson(`/api/nfc-tags/${id}`, { taskId: taskId || null });
    await revalidate();
  }

  async function toggleActive(id: string, active: boolean) {
    await patchJson(`/api/nfc-tags/${id}`, { active: !active });
    await revalidate();
  }

  async function copyUrl(token: string) {
    try {
      await navigator.clipboard.writeText(tagUrl(token));
    } catch {
      // Clipboard access denied — the URL is still shown as plain text to copy manually.
    }
  }

  const tags = data?.tags ?? [];

  return (
    <div id="nfc-tags" className="space-y-3 rounded-[var(--radius-card)] border border-border bg-surface p-4 scroll-mt-20">
      <h2 className="text-sm font-extrabold uppercase tracking-wide text-text-muted">NFC / QR Tags</h2>
      <p className="text-xs text-text-muted">
        Register a tag for each physical NFC sticker (or printed QR code). Tapping/scanning a tag instantly completes
        whatever task it&rsquo;s assigned to — you can reassign a tag to a different task any time without touching
        the sticker itself.
      </p>

      {!isLoading && tags.length === 0 ? <p className="text-sm text-text-muted">No tags registered yet.</p> : null}

      <div className="space-y-2">
        {tags.map((tag) => (
          <div key={tag.id} className="rounded-[var(--radius-control)] border border-border bg-surface-alt p-3">
            <div className="flex items-center gap-2">
              <input
                defaultValue={tag.label}
                onBlur={(e) => e.target.value !== tag.label && renameTag(tag.id, e.target.value)}
                placeholder="Tag name (e.g. Washing machine)"
                className={`min-w-0 flex-1 rounded-[var(--radius-control)] border border-border bg-surface px-2.5 py-1.5 text-sm font-bold ${tag.active ? "" : "text-text-muted line-through"}`}
              />
              <button
                onClick={() => toggleActive(tag.id, tag.active)}
                className="shrink-0 rounded-full border border-border px-2.5 py-1 text-xs font-bold text-text-muted"
              >
                {tag.active ? "Disable" : "Enable"}
              </button>
              <button
                onClick={() => setExpandedId(expandedId === tag.id ? null : tag.id)}
                className="shrink-0 rounded-full border border-border px-2.5 py-1 text-xs font-bold text-text-muted"
              >
                {expandedId === tag.id ? "Hide" : "QR"}
              </button>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-text-muted">
              <select
                value={tag.taskId ?? ""}
                onChange={(e) => assignTag(tag.id, e.target.value)}
                className="rounded-[var(--radius-control)] border border-border bg-surface px-2 py-1 text-xs"
              >
                <option value="">Unassigned</option>
                {tasks.map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.icon} {task.name}
                  </option>
                ))}
              </select>
              <span>{tag.lastUsedAt ? `Last used ${formatRelativeTime(tag.lastUsedAt)}` : "Never used"}</span>
            </div>

            {expandedId === tag.id ? (
              <div className="mt-3 flex flex-col items-center gap-2 border-t border-border pt-3">
                <QrCodeImage url={tagUrl(tag.token)} downloadName={`${tag.label || "nfc-tag"}-qr.png`} size={140} />
                <div className="flex items-center gap-2">
                  <code className="max-w-[220px] truncate rounded bg-surface px-2 py-1 text-[0.7rem]">
                    {tagUrl(tag.token)}
                  </code>
                  <button
                    onClick={() => copyUrl(tag.token)}
                    className="rounded-full px-2.5 py-1 text-xs font-bold"
                    style={{ backgroundColor: "var(--color-primary-soft)", color: "var(--color-primary)" }}
                  >
                    Copy
                  </button>
                </div>
                <p className="text-center text-[0.7rem] text-text-muted">
                  Write this URL to the physical NFC tag, or print/download the QR code.
                </p>
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <button
        onClick={addTag}
        disabled={creating}
        className="w-full rounded-full border-2 border-dashed border-border py-2 text-sm font-bold text-text-muted disabled:opacity-60"
      >
        {creating ? "Adding…" : "+ Register a new tag"}
      </button>
    </div>
  );
}
