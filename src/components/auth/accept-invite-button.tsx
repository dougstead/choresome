"use client";

import { useState } from "react";
import { postJson } from "@/lib/client/fetcher";
import { FormError } from "./auth-shell";
import { hardNavigate } from "@/lib/client/navigate";

export function AcceptInviteButton({ token, householdName }: { token: string; householdName: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    setBusy(true);
    setError(null);
    try {
      await postJson(`/api/invites/${encodeURIComponent(token)}/accept`, {});
      hardNavigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not join the household.");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <FormError message={error} />
      <button
        onClick={accept}
        disabled={busy}
        className="w-full rounded-full py-3 text-sm font-extrabold disabled:opacity-60"
        style={{ backgroundColor: "var(--color-primary)", color: "var(--color-primary-foreground)" }}
      >
        {busy ? "Joining…" : `Join ${householdName}`}
      </button>
    </div>
  );
}
