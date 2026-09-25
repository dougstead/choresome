"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/client/fetcher";
import { formatDate } from "@/lib/format";
import type { AreaDto, CompletionEventWithTaskDto, MemberDto } from "@/lib/api/types";

function groupLabel(dateIso: string, dateFormat: string): string {
  const date = new Date(dateIso);
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return formatDate(date, dateFormat);
}

export function HistoryBrowser({
  members,
  areas,
  dateFormat,
}: {
  members: MemberDto[];
  areas: AreaDto[];
  dateFormat: string;
}) {
  const [memberId, setMemberId] = useState("");
  const [areaId, setAreaId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const params = new URLSearchParams({ limit: "50" });
  if (memberId) params.set("memberId", memberId);
  if (areaId) params.set("areaId", areaId);
  if (from) params.set("from", new Date(from).toISOString());
  if (to) params.set("to", new Date(`${to}T23:59:59`).toISOString());

  const { data, isLoading } = useSWR<{ events: CompletionEventWithTaskDto[] }>(
    `/api/completions?${params.toString()}`,
    fetcher
  );

  const groups = useMemo(() => {
    const events = data?.events ?? [];
    const map = new Map<string, CompletionEventWithTaskDto[]>();
    for (const event of events) {
      const label = groupLabel(event.completedAt, dateFormat);
      const list = map.get(label) ?? [];
      list.push(event);
      map.set(label, list);
    }
    return Array.from(map.entries());
  }, [data, dateFormat]);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-2">
        <select value={memberId} onChange={(e) => setMemberId(e.target.value)} className="rounded-[var(--radius-control)] border border-border bg-surface px-3 py-2 text-sm">
          <option value="">Everyone</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.icon} {m.name}
            </option>
          ))}
        </select>
        <select value={areaId} onChange={(e) => setAreaId(e.target.value)} className="rounded-[var(--radius-control)] border border-border bg-surface px-3 py-2 text-sm">
          <option value="">All areas</option>
          {areas.map((a) => (
            <option key={a.id} value={a.id}>
              {a.icon} {a.name}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="rounded-[var(--radius-control)] border border-border bg-surface px-3 py-2 text-sm"
          aria-label="From date"
        />
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="rounded-[var(--radius-control)] border border-border bg-surface px-3 py-2 text-sm"
          aria-label="To date"
        />
      </div>

      {isLoading ? <p className="text-sm text-text-muted">Loading…</p> : null}

      {!isLoading && groups.length === 0 ? (
        <p className="rounded-[var(--radius-card)] border border-dashed border-border p-6 text-center text-sm text-text-muted">
          No activity matches these filters.
        </p>
      ) : null}

      {groups.map(([label, events]) => (
        <section key={label}>
          <h2 className="mb-2 text-sm font-extrabold uppercase tracking-wide text-text-muted">{label}</h2>
          <ul className="space-y-2">
            {events.map((event) => (
              <li key={event.id} className="flex items-center gap-3 rounded-[var(--radius-card)] border border-border bg-surface p-3.5">
                <span className="text-xl">{event.task.icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm">
                    <span className="font-bold">{event.member.name}</span> completed{" "}
                    <span className="font-bold">{event.task.name}</span>
                  </span>
                  <span className="text-xs text-text-muted">
                    {new Date(event.completedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                    {" · "}
                    {event.task.area.icon} {event.task.area.name}
                    {event.note ? ` · ${event.note}` : ""}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
