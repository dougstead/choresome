"use client";

import { useState } from "react";
import { mutate as globalMutate } from "swr";
import { useMembers } from "@/hooks/use-household-data";
import { patchJson, postJson } from "@/lib/client/fetcher";

const ICONS = ["🙂", "🧔", "👩", "👨", "🧑", "👵", "👴", "🧒"];

function revalidate() {
  return globalMutate((key) => typeof key === "string" && key.startsWith("/api/"), undefined, { revalidate: true });
}

export function MembersManager() {
  const { members } = useMembers(true);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState(ICONS[0]);

  async function addMember(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await postJson("/api/members", { name: name.trim(), icon });
    setName("");
    setAdding(false);
    await revalidate();
  }

  async function toggleActive(id: string, active: boolean) {
    await patchJson(`/api/members/${id}`, { active: !active });
    await revalidate();
  }

  return (
    <div className="space-y-3 rounded-[var(--radius-card)] border border-border bg-surface p-4">
      <h2 className="text-sm font-extrabold uppercase tracking-wide text-text-muted">Household members</h2>
      <div className="space-y-2">
        {members.map((member) => (
          <div key={member.id} className="flex items-center gap-3">
            <span className="text-xl">{member.icon}</span>
            <span className={`flex-1 text-sm font-bold ${member.active ? "" : "text-text-muted line-through"}`}>{member.name}</span>
            <button
              onClick={() => toggleActive(member.id, member.active)}
              className="rounded-full border border-border px-3 py-1 text-xs font-bold text-text-muted"
            >
              {member.active ? "Deactivate" : "Reactivate"}
            </button>
          </div>
        ))}
      </div>

      {adding ? (
        <form onSubmit={addMember} className="space-y-2 rounded-[var(--radius-control)] bg-surface-alt p-3">
          <div className="flex flex-wrap gap-1.5">
            {ICONS.map((i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIcon(i)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border-2 text-sm"
                style={{ borderColor: icon === i ? "var(--color-primary)" : "var(--color-border)" }}
              >
                {i}
              </button>
            ))}
          </div>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
            className="w-full rounded-[var(--radius-control)] border border-border bg-surface px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              className="flex-1 rounded-full py-2 text-sm font-bold"
              style={{ backgroundColor: "var(--color-primary)", color: "var(--color-primary-foreground)" }}
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="flex-1 rounded-full border border-border py-2 text-sm font-bold text-text-muted"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button onClick={() => setAdding(true)} className="w-full rounded-full border-2 border-dashed border-border py-2 text-sm font-bold text-text-muted">
          + Add member
        </button>
      )}
    </div>
  );
}
