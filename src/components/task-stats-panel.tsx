"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/client/fetcher";
import type { TaskStats } from "@/lib/services/stats-service";

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-control)] bg-surface-alt p-3 text-center">
      <p className="text-lg font-extrabold">{value}</p>
      <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-text-muted">{label}</p>
    </div>
  );
}

export function TaskStatsPanel({ taskId }: { taskId: string }) {
  const { data, isLoading } = useSWR<TaskStats>(`/api/stats/tasks/${taskId}`, fetcher);

  if (isLoading || !data) return <p className="text-sm text-text-muted">Loading stats…</p>;

  if (data.totalCompletions === 0) {
    return (
      <p className="rounded-[var(--radius-card)] border border-dashed border-border p-4 text-center text-sm text-text-muted">
        No statistics yet — complete this task at least once.
      </p>
    );
  }

  const round = (n: number | null) => (n === null ? "—" : n < 10 ? n.toFixed(1) : Math.round(n).toString());

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <StatTile label="Total" value={String(data.totalCompletions)} />
        <StatTile label="Last 30 days" value={String(data.completionsLast30Days)} />
        <StatTile label="Last 12 months" value={String(data.completionsLast12Months)} />
        <StatTile label="Avg. interval" value={data.averageIntervalDays === null ? "—" : `${round(data.averageIntervalDays)}d`} />
        <StatTile label="Longest gap" value={data.longestIntervalDays === null ? "—" : `${round(data.longestIntervalDays)}d`} />
        <StatTile label="Since last" value={data.currentIntervalDays === null ? "—" : `${round(data.currentIntervalDays)}d`} />
      </div>
      {data.completionsByMember.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {data.completionsByMember.map((m) => (
            <span key={m.memberId} className="rounded-full bg-surface-alt px-3 py-1 text-xs font-semibold">
              {m.memberName}: {m.count}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
