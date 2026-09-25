"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon } from "./icons";
import { postJson } from "@/lib/client/fetcher";

const ICONS = ["🏠", "🍳", "🛁", "🛏️", "🛋️", "🚪", "🌿", "🚗", "🧺", "🗄️"];

export function AddAreaButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState(ICONS[0]);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await postJson("/api/areas", { name: name.trim(), icon });
      setOpen(false);
      setName("");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-[var(--radius-card)] border-2 border-dashed border-border py-4 text-sm font-bold text-text-muted"
      >
        <PlusIcon width={18} height={18} />
        Add area
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-[var(--radius-card)] border-2 border-border bg-surface-alt p-4">
      <div className="flex flex-wrap gap-1.5">
        {ICONS.map((i) => (
          <button
            key={i}
            type="button"
            onClick={() => setIcon(i)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border-2 text-base"
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
        placeholder="Area name"
        className="w-full rounded-[var(--radius-control)] border border-border bg-surface px-4 py-2.5 text-base"
      />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 rounded-full py-2.5 text-sm font-bold"
          style={{ backgroundColor: "var(--color-primary)", color: "var(--color-primary-foreground)" }}
        >
          {saving ? "Adding…" : "Add"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="flex-1 rounded-full border border-border py-2.5 text-sm font-bold text-text-muted"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
