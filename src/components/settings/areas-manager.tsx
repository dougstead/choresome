"use client";

import { useState } from "react";
import { mutate as globalMutate } from "swr";
import { useAreas } from "@/hooks/use-household-data";
import { patchJson } from "@/lib/client/fetcher";
import { AddAreaButton } from "@/components/add-area-button";

function revalidate() {
  return globalMutate((key) => typeof key === "string" && key.startsWith("/api/"), undefined, { revalidate: true });
}

export function AreasManager() {
  const { areas } = useAreas(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");

  async function rename(id: string) {
    if (name.trim()) await patchJson(`/api/areas/${id}`, { name: name.trim() });
    setEditingId(null);
    await revalidate();
  }

  async function toggleArchived(id: string, archived: boolean) {
    await patchJson(`/api/areas/${id}`, { archived: !archived });
    await revalidate();
  }

  return (
    <div className="space-y-3 rounded-[var(--radius-card)] border border-border bg-surface p-4">
      <h2 className="text-sm font-extrabold uppercase tracking-wide text-text-muted">Areas</h2>
      <div className="space-y-2">
        {areas.map((area) => (
          <div key={area.id} className="flex items-center gap-3">
            <span className="text-xl">{area.icon}</span>
            {editingId === area.id ? (
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => rename(area.id)}
                onKeyDown={(e) => e.key === "Enter" && rename(area.id)}
                className="flex-1 rounded-[var(--radius-control)] border border-border bg-surface-alt px-2 py-1 text-sm"
              />
            ) : (
              <button
                onClick={() => {
                  setEditingId(area.id);
                  setName(area.name);
                }}
                className={`flex-1 text-left text-sm font-bold ${area.archived ? "text-text-muted line-through" : ""}`}
              >
                {area.name}
              </button>
            )}
            <button
              onClick={() => toggleArchived(area.id, area.archived)}
              className="rounded-full border border-border px-3 py-1 text-xs font-bold text-text-muted"
            >
              {area.archived ? "Unarchive" : "Archive"}
            </button>
          </div>
        ))}
      </div>
      <AddAreaButton />
    </div>
  );
}
