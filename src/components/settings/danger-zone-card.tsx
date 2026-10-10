"use client";

import { useState } from "react";
import { useMe } from "@/hooks/use-me";
import { useSettings } from "@/hooks/use-household-data";
import { deleteJson } from "@/lib/client/fetcher";
import { clearLocalHouseholdState } from "@/lib/client/sign-out";
import { hardNavigate } from "@/lib/client/navigate";

/** Owner-only: permanently delete the current household and everything in it. */
export function DangerZoneCard() {
  const { me } = useMe();
  const { settings } = useSettings();
  const [confirmName, setConfirmName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!me || !settings || me.role !== "OWNER") return null;

  async function deleteHousehold(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await deleteJson("/api/household", { confirmName });
      await clearLocalHouseholdState();
      hardNavigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete the household.");
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={deleteHousehold}
      className="space-y-3 rounded-[var(--radius-card)] border p-4"
      style={{ borderColor: "var(--color-overdue)" }}
    >
      <h2 className="text-sm font-extrabold uppercase tracking-wide" style={{ color: "var(--color-overdue)" }}>
        Delete household
      </h2>
      <p className="text-xs text-text-muted">
        Permanently deletes <strong>{settings.name}</strong>: every task, area, member and the full completion history,
        for everyone in it. Export a backup first if you might want it back. Type the household&rsquo;s name to confirm.
      </p>
      <input
        value={confirmName}
        onChange={(e) => setConfirmName(e.target.value)}
        placeholder={settings.name}
        className="w-full rounded-[var(--radius-control)] border border-border bg-surface-alt px-3 py-2.5 text-base"
      />
      {error ? (
        <p className="text-xs font-semibold" style={{ color: "var(--color-overdue)" }}>
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={busy || confirmName.trim() !== settings.name.trim()}
        className="w-full rounded-full py-2.5 text-sm font-extrabold text-white disabled:opacity-40"
        style={{ backgroundColor: "var(--color-overdue)" }}
      >
        {busy ? "Deleting…" : "Delete this household forever"}
      </button>
    </form>
  );
}
