"use client";

import Link from "next/link";
import useSWR from "swr";
import { fetcher } from "@/lib/client/fetcher";
import { formatRelativeTime } from "@/lib/format";
import type { NfcTagDto } from "@/lib/api/types";

/** Read-only summary of which NFC tags point at this task — management lives in Settings. */
export function TaskNfcTagsSummary({ taskId }: { taskId: string }) {
  const { data } = useSWR<{ tags: NfcTagDto[] }>("/api/nfc-tags", fetcher);
  const assigned = (data?.tags ?? []).filter((tag) => tag.taskId === taskId);

  return (
    <div className="rounded-[var(--radius-card)] border border-border bg-surface p-4">
      <h2 className="mb-2 text-sm font-extrabold uppercase tracking-wide text-text-muted">NFC / QR tags</h2>
      {assigned.length === 0 ? (
        <p className="text-sm text-text-muted">No tag assigned to this task yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {assigned.map((tag) => (
            <li key={tag.id} className="flex items-center justify-between text-sm">
              <span className={tag.active ? "font-semibold" : "font-semibold text-text-muted line-through"}>
                {tag.label || "Untitled tag"}
              </span>
              <span className="text-xs text-text-muted">
                {tag.lastUsedAt ? `Used ${formatRelativeTime(tag.lastUsedAt)}` : "Never used"}
              </span>
            </li>
          ))}
        </ul>
      )}
      <Link
        href="/settings#nfc-tags"
        className="mt-2 inline-block text-xs font-bold"
        style={{ color: "var(--color-primary)" }}
      >
        Manage tags in Settings →
      </Link>
    </div>
  );
}
