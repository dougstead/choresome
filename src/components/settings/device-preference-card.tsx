"use client";

import { useEffect, useState } from "react";
import { useMembers } from "@/hooks/use-household-data";
import { getPreferredMemberId, setPreferredMemberId } from "@/lib/client/member-preference";

export function DevicePreferenceCard() {
  const { members } = useMembers();
  const [preferred, setPreferred] = useState<string | null>(null);

  // Reads localStorage, so it must run client-side only, after mount — doing this
  // synchronously during render would mismatch the server-rendered HTML.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setPreferred(getPreferredMemberId()), []);

  function choose(id: string | null) {
    setPreferredMemberId(id);
    setPreferred(id);
  }

  return (
    <div className="space-y-3 rounded-[var(--radius-card)] border border-border bg-surface p-4">
      <h2 className="text-sm font-extrabold uppercase tracking-wide text-text-muted">This device</h2>
      <p className="text-xs text-text-muted">
        When set, completing a task on this device skips asking who did it. Leave unset for a shared device.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => choose(null)}
          className="rounded-full border-2 px-3 py-2 text-sm font-bold"
          style={{
            borderColor: preferred === null ? "var(--color-primary)" : "var(--color-border)",
            backgroundColor: preferred === null ? "var(--color-primary-soft)" : "transparent",
          }}
        >
          Ask every time
        </button>
        {members.map((m) => (
          <button
            key={m.id}
            onClick={() => choose(m.id)}
            className="flex items-center gap-1.5 rounded-full border-2 px-3 py-2 text-sm font-bold"
            style={{
              borderColor: preferred === m.id ? "var(--color-primary)" : "var(--color-border)",
              backgroundColor: preferred === m.id ? "var(--color-primary-soft)" : "transparent",
            }}
          >
            {m.icon} {m.name}
          </button>
        ))}
      </div>
    </div>
  );
}
